export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: {
    timeoutSeconds: number;
  };
}

export interface PickerMediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: {
      cameraMake?: string;
      cameraModel?: string;
      focalLength?: number;
      apertureFNumber?: number;
      isoEquivalent?: number;
    };
  };
  filename: string;
}

export interface PickerMediaItemsResponse {
  mediaItems: PickerMediaItem[];
  nextPageToken?: string;
}

export async function createPickerSession(
  accessToken: string
): Promise<PickerSession> {
  const response = await fetch(
    "https://photospicker.googleapis.com/v1/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to create picker session: ${response.status} ${error}`
    );
  }

  const session = await response.json();
  
  return {
    ...session,
    pickerUri: `${session.pickerUri}/autoclose`,
  };
}

export async function getPickerSession(
  accessToken: string,
  sessionId: string
): Promise<PickerSession> {
  const response = await fetch(
    `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to get picker session: ${response.status} ${error}`
    );
  }

  return response.json();
}

export async function getSessionMediaItems(
  accessToken: string,
  sessionId: string,
  pageToken?: string,
  pageSize: number = 100
): Promise<PickerMediaItemsResponse> {
  const url = new URL(
    `https://photospicker.googleapis.com/v1/mediaItems`
  );
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("pageSize", pageSize.toString());
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to get session media items: ${response.status} ${error}`
    );
  }

  return response.json();
}

export async function deletePickerSession(
  accessToken: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to delete picker session: ${response.status} ${error}`
    );
  }
}

export async function pollSessionUntilReady(
  accessToken: string,
  sessionId: string,
  maxAttempts: number = 30,
  intervalMs: number = 2000
): Promise<PickerSession> {
  for (let i = 0; i < maxAttempts; i++) {
    const session = await getPickerSession(accessToken, sessionId);

    if (session.mediaItemsSet) {
      return session;
    }

    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(
    `Picker session ${sessionId} did not complete within timeout period`
  );
}



