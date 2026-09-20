const fs = require("fs");
const vm = require("vm");

const projectDir = "C:/Users/SYP/.workbuddy/skills/generate-lightweight-travel-page";

const noop = () => {};
const elStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "textContent" || k === "innerHTML" || k === "value") return "";
    if (k === "classList") return { toggle: noop, add: noop, remove: noop, contains: () => false };
    if (k === "style") return {};
    if (k === "dataset") return {};
    if (["setAttribute","removeAttribute","focus","addEventListener","removeEventListener","appendChild","replaceChildren","remove"].includes(k)) return noop;
    if (k === "closest" || k === "querySelector") return () => elStub;
    if (k === "querySelectorAll") return () => [];
    return undefined;
  },
  set: () => true
});
const documentStub = {
  addEventListener: noop,
  querySelector: () => elStub,
  querySelectorAll: () => [],
  getElementById: () => elStub,
  createElement: () => elStub,
  dispatchEvent: noop,
  documentElement: { dataset: {} },
  body: { style: {} },
  title: ""
};

const sandbox = {
  console,
  Intl, Date, Math, JSON, String, Array, Number, Object, Boolean, Set, Map, RegExp,
  encodeURIComponent, decodeURIComponent,
  URL, CustomEvent: function(){}, 
  setTimeout, clearTimeout, setInterval: noop, clearInterval: noop,
  requestAnimationFrame: () => 0,
  document: documentStub,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  location: { href: "http://localhost/", hash: "" },
  navigator: { userAgent: "node" }
};
const windowObj = { travelRuntimeStorage: undefined };
sandbox.window = windowObj;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// 1) inline data -> window.__TRAVEL_DATA__
const dataJs = fs.readFileSync(projectDir + "/trip-data.js", "utf8");
vm.runInContext(dataJs, sandbox, { filename: "trip-data.js" });

// 2) app.js + expose internal state/funcs from same lexical scope
let appJs = fs.readFileSync(projectDir + "/app.js", "utf8");
appJs += "\n;globalThis.__state = state; globalThis.__dayCard = dayCard; globalThis.__normalize = normalizeTripConfig; globalThis.__navDest = navigationDestinations;\n";
vm.runInContext(appJs, sandbox, { filename: "app.js" });

const TRAVEL = windowObj.__TRAVEL_DATA__;
sandbox.__state.data = TRAVEL;
sandbox.__state.config = sandbox.__normalize(TRAVEL.config);

let failed = false;
const summaries = [];
for (const day of TRAVEL.days) {
  try {
    const html = sandbox.__dayCard(day);
    const ok = typeof html === "string" && html.includes(day.title);
    summaries.push(`Day ${day.day} "${day.title}": ${ok ? "OK (" + html.length + " chars)" : "TITLE MISSING"}`);
    if (!ok) failed = true;
  } catch (e) {
    failed = true;
    summaries.push(`Day ${day.day} THREW: ${e.message}`);
  }
}

console.log("=== dayCard render check (function that was crashing) ===");
summaries.forEach(s => console.log(s));
console.log("\nnavigationPolicy (inline data) =", JSON.stringify(TRAVEL.mapLinks.navigationPolicy));
console.log("modules.itinerary =", sandbox.__state.config.modules.itinerary);
console.log(failed ? "\nRESULT: STILL FAILING" : "\nRESULT: ALL DAYS RENDER OK");
process.exit(failed ? 1 : 0);
