export type Raw = {
  id: string;
  text: string;
  createdAt: string;
};

export type RawInput = Pick<Raw, "text">;
