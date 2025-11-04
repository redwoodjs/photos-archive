"use client";

import { useState, useEffect } from "react";

export const Photos = () => {
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "not_authenticated">("checking");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/test-photos");
      const data = await response.json();
      
      if (response.ok) {
        setAuthStatus("authenticated");
        setTestResult(`Success: ${data.message}`);
      } else {
        setAuthStatus("not_authenticated");
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setAuthStatus("not_authenticated");
      setTestResult(`Error: ${error instanceof Error ? error.message : "Failed to check authentication"}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuth = () => {
    window.location.href = "/auth/google";
  };

  const handleTest = async () => {
    setIsLoading(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/test-photos");
      const data = await response.json();
      
      if (response.ok) {
        setTestResult(`Success: ${data.message}`);
        if (data.albums && data.albums.length > 0) {
          setTestResult(`${data.message}\n\nAlbums:\n${data.albums.map((a: { id: string; title: string }) => `- ${a.title}`).join("\n")}`);
        }
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setTestResult(`Error: ${error instanceof Error ? error.message : "Test failed"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Google Photos API Access</h1>
      
      <div style={{ marginTop: "2rem" }}>
        {authStatus === "not_authenticated" ? (
          <div>
            <p>You are not authenticated with Google Photos.</p>
            <button 
              onClick={handleAuth}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: "#4285f4",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginTop: "1rem"
              }}
            >
              Authenticate with Google
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: "green" }}>✓ Authenticated with Google Photos</p>
            <button
              onClick={handleTest}
              disabled={isLoading}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: "#34a853",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "not-allowed" : "pointer",
                marginTop: "1rem",
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? "Testing..." : "Test API Connection"}
            </button>
          </div>
        )}
      </div>

      {testResult && (
        <div style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "#f5f5f5",
          borderRadius: "4px",
          whiteSpace: "pre-wrap",
          fontFamily: "monospace",
          fontSize: "0.9rem"
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
};
