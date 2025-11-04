export interface MediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    creationTime: string;
    width: string;
    height: string;
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

export interface ListMediaItemsResponse {
  mediaItems: MediaItem[];
  nextPageToken?: string;
}

export async function listMediaItems(
  accessToken: string,
  pageToken?: string,
  pageSize: number = 25
): Promise<ListMediaItemsResponse> {
  const url = new URL("https://photoslibrary.googleapis.com/v1/mediaItems");
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
    throw new Error(`Google Photos API error: ${response.status} ${error}`);
  }

  return response.json();
}

export async function getMediaItem(
  accessToken: string,
  mediaItemId: string
): Promise<MediaItem> {
  const url = new URL(
    `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`
  );

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Photos API error: ${response.status} ${error}`);
  }

  return response.json();
}

export async function listAlbums(
  accessToken: string,
  pageToken?: string,
  pageSize: number = 50
): Promise<{
  albums: Array<{ id: string; title: string }>;
  nextPageToken?: string;
}> {
  const url = new URL("https://photoslibrary.googleapis.com/v1/albums");
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
    throw new Error(`Google Photos API error: ${response.status} ${error}`);
  }

  return response.json();
}
