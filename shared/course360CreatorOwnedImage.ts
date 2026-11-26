/** An authoritative NEW Creator image saved in the current school's main Media Library. */
export type CreatorOwnedImageResult = {
  orgId: number;
  mediaId: number;
  url: string;
  key: string;
  mimeType: "image/png";
  fileSize: number;
  width: number;
  height: number;
  alt: string;
};
