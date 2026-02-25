import cluster from "cluster";
import os from "os";
import { config } from "./config";

const numWorkers = config.workers ?? os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Gateway primary: spawning ${numWorkers} workers (port ${config.port})`);
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} exited (${code ?? signal}). Restarting.`);
    cluster.fork();
  });
} else {
  import("./worker").then(({ startWorker }) => startWorker().catch((err) => {
    console.error(err);
    process.exit(1);
  }));
}
