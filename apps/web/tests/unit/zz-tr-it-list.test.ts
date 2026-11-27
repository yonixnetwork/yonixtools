import { it } from "vitest";
import { localeReport } from "@/i18n/catalogue";
it("list", () => { const r = localeReport("it"); console.log("LIST", JSON.stringify(r.keys.filter((k:any)=>k.state!=="machine").map((k:any)=>`${k.ns}:${k.key} ${k.state} ${k.problems??""}`))); console.log("DUP", JSON.stringify(r.duplicateSlugs), JSON.stringify(r.extra)); });
