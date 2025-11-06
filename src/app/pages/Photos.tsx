"use client";

import { useState, useEffect } from "react";

interface MediaItem {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
  };
}

export const Photos = () => {
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "not_authenticated"
  >("checking");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaItemsSet, setMediaItemsSet] = useState(false);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/test-photos");
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (response.ok) {
        setAuthStatus("authenticated");
        setTestResult(`Success: ${data.message}`);
      } else {
        setAuthStatus("not_authenticated");
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setAuthStatus("not_authenticated");
      setTestResult(
        `Error: ${
          error instanceof Error
            ? error.message
            : "Failed to check authentication"
        }`
      );
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
      const data = (await response.json()) as {
        message?: string;
        error?: string;
        albums?: Array<{ id: string; title: string }>;
      };

      if (response.ok) {
        setTestResult(`Success: ${data.message}`);
        if (data.albums && data.albums.length > 0) {
          setTestResult(
            `${data.message}\n\nAlbums:\n${data.albums
              .map((a: { id: string; title: string }) => `- ${a.title}`)
              .join("\n")}`
          );
        }
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setTestResult(
        `Error: ${error instanceof Error ? error.message : "Test failed"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPicker = async () => {
    setIsLoading(true);
    setTestResult(null);
    setMediaItemsSet(false);
    try {
      const response = await fetch("/api/picker/session", {
        method: "POST",
      });
      const data = (await response.json()) as {
        sessionId?: string;
        pickerUri?: string;
        error?: string;
      };

      if (response.ok) {
        setSessionId(data.sessionId ?? null);
        setPickerUri(data.pickerUri ?? null);
        setTestResult(
          `Picker session created: ${data.sessionId}\n\nPlease click "Open Google Photos Picker" to select photos.`
        );
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setTestResult(
        `Error: ${
          error instanceof Error ? error.message : "Failed to start picker"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckSessionStatus = async () => {
    if (!sessionId) {
      setTestResult("Error: No session ID available");
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/picker/session/${sessionId}/status`);
      const data = (await response.json()) as {
        sessionId?: string;
        mediaItemsSet?: boolean;
        error?: string;
      };

      if (response.ok) {
        const isReady = data.mediaItemsSet ?? false;
        setMediaItemsSet(isReady);
        if (isReady) {
          setTestResult(
            `Session is ready! You can now click "Get Session Media Items".`
          );
        } else {
          setTestResult(
            `Session is not ready. Please open the picker, select photos, and confirm your selection.`
          );
        }
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setTestResult(
        `Error: ${
          error instanceof Error
            ? error.message
            : "Failed to check session status"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetMediaItems = async () => {
    if (!sessionId) {
      setTestResult("Error: No session ID available");
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/picker/session/${sessionId}/media`);
      const data = (await response.json()) as {
        mediaItems?: MediaItem[];
        error?: string;
      };

      if (response.ok && data.mediaItems) {
        setMediaItems(data.mediaItems);
        setTestResult(
          `Success: Retrieved ${data.mediaItems.length} media items`
        );
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setTestResult(
        `Error: ${
          error instanceof Error ? error.message : "Failed to get media items"
        }`
      );
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
                marginTop: "1rem",
              }}
            >
              Authenticate with Google
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: "green" }}>✓ Authenticated with Google Photos</p>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
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
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? "Testing..." : "Test API Connection"}
              </button>
              <button
                onClick={handleStartPicker}
                disabled={isLoading}
                style={{
                  padding: "0.75rem 1.5rem",
                  fontSize: "1rem",
                  backgroundColor: "#4285f4",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? "Starting..." : "Start Picker"}
              </button>
            </div>
            {pickerUri && (
              <div style={{ marginTop: "1rem" }}>
                <a
                  href={pickerUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "0.75rem 1.5rem",
                    fontSize: "1rem",
                    backgroundColor: "#fbbc04",
                    color: "#000",
                    textDecoration: "none",
                    borderRadius: "4px",
                  }}
                >
                  Open Google Photos Picker
                </a>
              </div>
            )}
            {sessionId && (
              <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
                <button
                  onClick={handleCheckSessionStatus}
                  disabled={isLoading}
                  style={{
                    padding: "0.75rem 1.5rem",
                    fontSize: "1rem",
                    backgroundColor: "#34a853",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? "Checking..." : "Check Session Status"}
                </button>
                <button
                  onClick={handleGetMediaItems}
                  disabled={isLoading || !mediaItemsSet}
                  style={{
                    padding: "0.75rem 1.5rem",
                    fontSize: "1rem",
                    backgroundColor: "#ea4335",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor:
                      isLoading || !mediaItemsSet ? "not-allowed" : "pointer",
                    opacity: isLoading || !mediaItemsSet ? 0.6 : 1,
                  }}
                  title={
                    !mediaItemsSet
                      ? "Select photos in the picker first, then check session status"
                      : "Get selected media items"
                  }
                >
                  {isLoading ? "Loading..." : "Get Session Media Items"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {testResult && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: "0.9rem",
          }}
        >
          {testResult}
        </div>
      )}

      {mediaItems.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Selected Media Items ({mediaItems.length})</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {mediaItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={`${item.baseUrl}=w400-h400`}
                  alt={item.filename}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
                <div style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.filename}
                  </div>
                  {item.mediaMetadata?.width && item.mediaMetadata?.height && (
                    <div style={{ color: "#666", fontSize: "0.75rem" }}>
                      {item.mediaMetadata.width} × {item.mediaMetadata.height}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
