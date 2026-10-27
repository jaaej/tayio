import { config } from "zod";

// Runs in the browser before the app. Zod tests whether it may compile
// parsers with `new Function`; the CSP forbids eval, so that test failed on
// every page and the browser logged a CSP violation for it. Zod then parsed
// without compiling anyway, so telling it up front changes nothing else.
config({ jitless: true });
