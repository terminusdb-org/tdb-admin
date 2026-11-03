/**
 * Unit tests for the config module — verifies auth mode switching logic.
 *
 * Tests the pure buildConfig() and parseAuthMode() functions directly
 * without needing to manipulate import.meta.env (which Vite replaces at compile time).
 */

import { describe, it, expect } from "vitest";
import { buildConfig, parseAuthMode } from "./env";

describe("parseAuthMode", () => {
  it("returns 'basic' when input is undefined", () => {
    expect(parseAuthMode(undefined)).toBe("basic");
  });

  it("returns 'basic' when input is empty string", () => {
    expect(parseAuthMode("")).toBe("basic");
  });

  it("returns 'basic' when input is 'basic'", () => {
    expect(parseAuthMode("basic")).toBe("basic");
  });

  it("returns 'proxy' when input is 'proxy'", () => {
    expect(parseAuthMode("proxy")).toBe("proxy");
  });

  it("returns 'basic' for unrecognised values (safe default)", () => {
    expect(parseAuthMode("bearer")).toBe("basic");
    expect(parseAuthMode("oauth")).toBe("basic");
    expect(parseAuthMode("Proxy")).toBe("basic"); // case-sensitive
  });
});

describe("buildConfig", () => {
  describe("basic mode", () => {
    it("uses VITE_TDB_URL as apiUrl", () => {
      const result = buildConfig({
        authMode: "basic",
        tdbUrl: "http://localhost:6363",
        tdbUser: "admin",
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("http://localhost:6363");
      expect(result.authMode).toBe("basic");
      expect(result.tdbUser).toBe("admin");
    });

    it("strips trailing slash from tdbUrl", () => {
      const result = buildConfig({
        authMode: "basic",
        tdbUrl: "http://localhost:6363/",
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("http://localhost:6363");
    });

    it("throws if tdbUrl is missing in basic mode", () => {
      expect(() => buildConfig({
        authMode: "basic",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      })).toThrow("VITE_TDB_URL is not configured");
    });

    it("treats empty tdbUrl as same-origin (embedded dashboard mode)", () => {
      const result = buildConfig({
        authMode: "basic",
        tdbUrl: "",
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("");
      expect(result.authMode).toBe("basic");
    });

    it("defaults tdbUser to 'admin' when not specified", () => {
      const result = buildConfig({
        authMode: "basic",
        tdbUrl: "http://localhost:6363",
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.tdbUser).toBe("admin");
    });

    it("defaults tdbUser to 'admin' when empty string", () => {
      const result = buildConfig({
        authMode: "basic",
        tdbUrl: "http://localhost:6363",
        tdbUser: "",
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.tdbUser).toBe("admin");
    });

    it("uses custom tdbUser when specified", () => {
      const result = buildConfig({
        authMode: "basic",
        tdbUrl: "http://localhost:6363",
        tdbUser: "superuser",
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.tdbUser).toBe("superuser");
    });

    it("sets devToken to null in basic mode even if provided", () => {
      const result = buildConfig({
        authMode: "basic",
        tdbUrl: "http://localhost:6363",
        tdbUser: "admin",
        devToken: "some-token",
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.devToken).toBeNull();
    });
  });

  describe("proxy mode", () => {
    it("uses /api/v1/admin as apiUrl (relative path through oauth2-proxy)", () => {
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("/api/v1/admin");
      expect(result.authMode).toBe("proxy");
    });

    it("does not require tdbUrl in proxy mode", () => {
      // Should not throw even without tdbUrl
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("/api/v1/admin");
    });

    it("ignores tdbUrl in proxy mode (uses relative path instead)", () => {
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: "http://localhost:6363",
        tdbUser: "admin",
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("/api/v1/admin");
    });

    it("defaults tdbUser to 'admin' in proxy mode", () => {
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.tdbUser).toBe("admin");
    });

    it("stores devToken in proxy mode", () => {
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: "test-jwt-token",
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.devToken).toBe("test-jwt-token");
    });

    it("sets devToken to null when not provided in proxy mode", () => {
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.devToken).toBeNull();
    });

    it("uses custom VITE_API_URL when provided in proxy mode", () => {
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: "http://localhost:8080/admin",
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("http://localhost:8080/admin");
    });

    it("strips trailing slash from VITE_API_URL", () => {
      const result = buildConfig({
        authMode: "proxy",
        tdbUrl: undefined,
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: "http://localhost:8080/admin/",
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.apiUrl).toBe("http://localhost:8080/admin");
    });
  });

  describe("authMode defaults", () => {
    it("defaults to basic when authMode is undefined", () => {
      const result = buildConfig({
        authMode: undefined,
        tdbUrl: "http://localhost:6363",
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.authMode).toBe("basic");
    });

    it("defaults to basic when authMode is unrecognised", () => {
      const result = buildConfig({
        authMode: "invalid",
        tdbUrl: "http://localhost:6363",
        tdbUser: undefined,
        devToken: undefined,
        apiUrl: undefined,
        openBaoEnabled: undefined,
        basePath: undefined,
      });

      expect(result.authMode).toBe("basic");
    });
  });

  describe("appVersion", () => {
    const env = {
      authMode: "basic",
      tdbUrl: "http://localhost:6363",
      tdbUser: undefined,
      devToken: undefined,
      apiUrl: undefined,
      openBaoEnabled: undefined,
      basePath: undefined,
    };

    it("defaults to dev when unset", () => {
      expect(buildConfig(env).appVersion).toBe("dev");
    });

    it("carries the release tag baked at build time", () => {
      expect(buildConfig({ ...env, appVersion: "v0.1.2" }).appVersion).toBe("v0.1.2");
    });
  });
});
