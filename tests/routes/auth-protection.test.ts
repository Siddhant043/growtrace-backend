import { describe, expect, it } from "vitest";

import analyticsRouter from "../../src/api/routes/analytics";
import dashboardRouter from "../../src/api/routes/dashboard";
import { authenticate } from "../../src/api/middlewares/authenticate";

type RouterLayer = {
  route?: {
    path: string;
    stack: Array<{ handle: unknown }>;
  };
};

const getRouteLayer = (routerStack: unknown[], routePath: string): RouterLayer | undefined =>
  (routerStack as RouterLayer[]).find((layer) => layer.route?.path === routePath);

describe("auth protection on analytics and dashboard routes", () => {
  it("protects dashboard endpoint", () => {
    const routeLayer = getRouteLayer((dashboardRouter as unknown as { stack: unknown[] }).stack, "/");
    expect(routeLayer?.route?.stack[0]?.handle).toBe(authenticate);
  });

  it("protects analytics endpoints", () => {
    const analyticsStack = (analyticsRouter as unknown as { stack: unknown[] }).stack;

    const overviewLayer = getRouteLayer(analyticsStack, "/overview");
    const platformLayer = getRouteLayer(analyticsStack, "/platform");
    const linksLayer = getRouteLayer(analyticsStack, "/links");
    const trendsLayer = getRouteLayer(analyticsStack, "/trends");
    const compareLayer = getRouteLayer(analyticsStack, "/compare");

    expect(overviewLayer?.route?.stack[0]?.handle).toBe(authenticate);
    expect(platformLayer?.route?.stack[0]?.handle).toBe(authenticate);
    expect(linksLayer?.route?.stack[0]?.handle).toBe(authenticate);
    expect(trendsLayer?.route?.stack[0]?.handle).toBe(authenticate);
    expect(compareLayer?.route?.stack[0]?.handle).toBe(authenticate);
  });
});
