import {
	CompositeHandleResolver,
	WellKnownHandleResolver,
	DohJsonHandleResolver,
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	LocalActorResolver,
} from "@atcute/identity-resolver";

const handleResolver = new CompositeHandleResolver({
	strategy: "race",
	methods: {
		http: new WellKnownHandleResolver(),
		dns: new DohJsonHandleResolver({ dohUrl: "https://cloudflare-dns.com/dns-query" }),
	},
});

const didDocumentResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
	},
});

export const compositeResolver = new LocalActorResolver({
	handleResolver,
	didDocumentResolver,
});
