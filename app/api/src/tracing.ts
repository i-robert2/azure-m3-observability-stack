// OpenTelemetry bootstrap — MUST be imported before anything else (see server.ts line 1).
// Auto-instruments HTTP (Express) and pg, exporting traces over OTLP/HTTP to the collector.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
  "http://otelc-opentelemetry-collector.monitoring.svc.cluster.local:4318";

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "notes-api",
  traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  // `as any` works around OpenTelemetry's well-known sdk-metrics version-skew type mismatch.
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
    exportIntervalMillis: 15000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().finally(() => process.exit(0));
});
