/** TEE extension entry point. */

import { Server } from "./base/server.js";
import { VERSION } from "./app/config.js";
import { register, reportState, setSignPort } from "./app/handlers.js";

const extPort = process.env.EXTENSION_PORT ?? "8080";
const sPort = process.env.SIGN_PORT ?? "9090";

setSignPort(sPort);

const server = new Server(extPort, sPort, VERSION, register, reportState);
server.listenAndServe();
