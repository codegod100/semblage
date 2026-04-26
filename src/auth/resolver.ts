import {
	CompositeHandleResolver,
	WellKnownHandleResolver,
	DohJsonHandleResolver,
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	LocalActorResolver,
} from "@atcute/identity-resolver";

const handleResolver = new CompositeHandleResolver({
	strategy: "race",
	methods: {
		http: new WellKnownHandleResolver(),
		dns: new DohJsonHandleResolver({ dohUrl: "https://cloudflare-dns.com/dns-query" }),
	},
});

export const didDocumentResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
});

export const compositeResolver = new LocalActorResolver({
	handleResolver,
	didDocumentResolver,
});
