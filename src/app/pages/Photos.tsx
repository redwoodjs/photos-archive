"use client";

import { useState, useEffect } from "react";

interface MediaItem {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    creationTime: string;
    width: string;
    height: string;
  };
}

export const Photos = () => {
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "not_authenticated">("checking");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<MediaItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const checkAuth = async () => {
    console.log(`[CLIENT] checkAuth called`);
    setIsLoading(true);
    try {
      const response = await fetch("/api/test-photos");
      console.log(`[CLIENT] checkAuth response status: ${response.status}`);
      
      if (response.ok) {
        console.log(`[CLIENT] checkAuth: authenticated`);
        setAuthStatus("authenticated");
      } else {
        const data = await response.json();
        console.log(`[CLIENT] checkAuth: not authenticated, error:`, data);
        setAuthStatus("not_authenticated");
      }
    } catch (error) {
      console.error(`[CLIENT] checkAuth error:`, error);
      setAuthStatus("not_authenticated");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log(`[CLIENT] Photos component mounted`);
    checkAuth();

    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get("session_id");
    if (urlSessionId) {
      console.log(`[CLIENT] Session ID found in URL: ${urlSessionId}`);
      setSessionId(urlSessionId);
      pollSessionAndLoadPhotos(urlSessionId);
    }
  }, []);

  const handleAuth = () => {
    window.location.href = "/auth/google";
  };

  const handleSelectPhotos = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/picker/session", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        window.location.href = data.pickerUri;
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Failed to create picker session"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const pollSessionAndLoadPhotos = async (sid: string) => {
    setIsLoading(true);
    setMessage("Waiting for photo selection...");

    try {
      let attempts = 0;
      const maxAttempts = 30;
      const intervalMs = 2000;

      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`/api/picker/session/${sid}/status`);
        const statusData = await statusResponse.json();

        if (statusResponse.ok && statusData.mediaItemsSet) {
          setMessage("Loading selected photos...");
          await loadPhotos(sid);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        attempts++;
      }

      setMessage("Timeout waiting for photo selection");
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Failed to check session status"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPhotos = async (sid: string) => {
    try {
      const response = await fetch(`/api/picker/session/${sid}/media`);
      const data = await response.json();

      if (response.ok) {
        setSelectedPhotos(data.mediaItems || []);
        setMessage(`Successfully loaded ${data.mediaItems?.length || 0} photo(s)`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Failed to load photos"}`);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Google Photos Picker</h1>
      
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
              onClick={handleSelectPhotos}
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
              {isLoading ? "Loading..." : "Select Photos"}
            </button>
          </div>
        )}
      </div>

      {message && (
        <div style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "#f5f5f5",
          borderRadius: "4px",
          fontSize: "0.9rem"
        }}>
          {message}
        </div>
      )}

      {selectedPhotos.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Selected Photos ({selectedPhotos.length})</h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem",
            marginTop: "1rem"
          }}>
            {selectedPhotos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "white"
                }}
              >
                <img
                  src={`${photo.baseUrl}=w400-h400`}
                  alt={photo.filename}
                  style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover"
                  }}
                />
                <div style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                    {photo.filename}
                  </div>
                  <div style={{ color: "#666", fontSize: "0.75rem" }}>
                    {new Date(photo.mediaMetadata.creationTime).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
