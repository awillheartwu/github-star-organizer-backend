import { Type } from "@sinclair/typebox";
export const __transformDate__ = (
  options?: Parameters<typeof Type.String>[0],
) =>
  Type.Transform(Type.String({ format: "date-time", ...options }))
    .Decode((value) => new Date(value))
    .Encode((value) => value.toISOString());
