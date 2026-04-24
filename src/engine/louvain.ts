/**
 * Louvain community detection — pure TypeScript, no dependencies.
 * Optimizes graph modularity by greedily moving nodes between communities.
 */
export function louvainCommunities(
	nodes: string[],
	edges: Array<{ source: string; target: string; weight?: number }>,
): Map<string, number> {
	// Build internal weighted graph
	const nodeIndex = new Map<string, number>();
	for (const n of nodes) nodeIndex.set(n, nodeIndex.size);
	const N = nodeIndex.size;
	if (N === 0) return new Map();

	const m2 = 2 * edges.reduce((sum, e) => sum + (e.weight || 1), 0);
	if (m2 === 0) {
		// No edges — every node in its own community
		const res = new Map<string, number>();
		for (const n of nodes) res.set(n, res.size);
		return res;
	}

	interface Community {
		nodes: Set<number>;
		kTot: number; // total weighted degree of community
	}

	// adjacency in sparse form: weight[nodeIndex][neighborIndex] = weight
	const adj = new Map<number, Map<number, number>>();
	const degree: number[] = new Array(N).fill(0);

	function addW(i: number, j: number, w: number) {
		let row = adj.get(i);
		if (!row) {
			row = new Map<number, number>();
			adj.set(i, row);
		}
		row.set(j, (row.get(j) || 0) + w);
	}

	for (const edge of edges) {
		const u = nodeIndex.get(edge.source);
		const v = nodeIndex.get(edge.target);
		if (u === undefined || v === undefined) continue;
		const w = edge.weight || 1;
		addW(u, v, w);
		if (u !== v) addW(v, u, w);
		degree[u] += w;
		degree[v] += w;
	}

	// Initial community assignment: each node in its own community
	const nodeComm = new Array<number>(N);
	const comms: Community[] = [];
	for (let i = 0; i < N; i++) {
		nodeComm[i] = i;
		comms.push({ nodes: new Set([i]), kTot: degree[i] });
	}

	function modularityGain(i: number, comm: number): number {
		const ki = degree[i];
		const kTot = comms[comm].kTot;
		const kr = comm === nodeComm[i] ? kTot - ki : kTot;
		// Sigma_in + k_{i,in} — but we subtract the existing contribution when moving out
		let kiIn = 0;
		const row = adj.get(i);
		if (row) {
			for (const [j, w] of row) {
				if (nodeComm[j] === comm) kiIn += w;
			}
		}
		if (comm === nodeComm[i]) kiIn = 0; // we are computing gain from removing, so treat internal edges as 0
		// standard Louvain gain formula: (kiIn / m2) - (ki * kr / (m2 * m2))
		return kiIn / m2 - (ki * kr) / (m2 * m2);
	}

	function move(i: number, to: number) {
		const from = nodeComm[i];
		if (from === to) return;
		// Update community totals
		const ki = degree[i];
		comms[from].kTot -= ki;
		comms[from].nodes.delete(i);
		comms[to].kTot += ki;
		comms[to].nodes.add(i);
		nodeComm[i] = to;
	}

	// Phase 1: local modularity optimization
	let improved = true;
	while (improved) {
		improved = false;
		for (let i = 0; i < N; i++) {
			const current = nodeComm[i];
			// Build set of neighboring communities
			const neighborComms = new Set<number>();
			const row = adj.get(i);
			if (row) {
				for (const [j] of row) {
					if (j !== i) neighborComms.add(nodeComm[j]);
				}
			}
			let bestComm = current;
			let bestGain = modularityGain(i, current);
			for (const comm of neighborComms) {
				const gain = modularityGain(i, comm);
				if (gain > bestGain || (gain === bestGain && comm < bestComm)) {
					bestGain = gain;
					bestComm = comm;
				}
			}
			if (bestComm !== current) {
				move(i, bestComm);
				improved = true;
			}
		}
	}

	// Phase 2: aggregate graph and recurse
	let activeCommunities = 0;
	const remapped = new Map<number, number>();
	const newNodeComm = new Array<number>(N);
	for (let i = 0; i < N; i++) {
		const c = nodeComm[i];
		if (!remapped.has(c)) {
			remapped.set(c, activeCommunities++);
		}
		newNodeComm[i] = remapped.get(c)!;
	}

	if (activeCommunities === N || activeCommunities === 1) {
		// No gain from aggregation, or completely collapsed
		const res = new Map<string, number>();
		for (const [n, idx] of nodeIndex) {
			res.set(n, newNodeComm[idx]);
		}
		return res;
	}

	// Build aggregate edges
	const agg = new Map<number, Map<number, number>>();
	for (let i = 0; i < N; i++) {
		const ci = newNodeComm[i];
		const row = adj.get(i);
		if (!row) continue;
		for (const [j, w] of row) {
			const cj = newNodeComm[j];
			if (ci <= cj) {
				if (!agg.has(ci)) agg.set(ci, new Map());
				agg.get(ci)!.set(cj, (agg.get(ci)!.get(cj) || 0) + w);
			}
		}
	}
	const aggNodes: string[] = [];
	for (let c = 0; c < activeCommunities; c++) {
		aggNodes.push(`__comm_${c}`);
	}
	const aggEdges: Array<{ source: string; target: string; weight?: number }> = [];
	for (const [ci, row] of agg) {
		for (const [cj, w] of row) {
			aggEdges.push({ source: `__comm_${ci}`, target: `__comm_${cj}`, weight: w });
		}
	}

	const next = louvainCommunities(aggNodes, aggEdges);
	const finalLabels = new Map<number, number>();
	for (const [key, val] of next) {
		const ci = parseInt(key.replace("__comm_", ""), 10);
		finalLabels.set(ci, val);
	}

	const res = new Map<string, number>();
	for (const [n, idx] of nodeIndex) {
		res.set(n, finalLabels.get(newNodeComm[idx])!);
	}
	return res;
}
