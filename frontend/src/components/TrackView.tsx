"use client";

import { useEffect } from "react";
import { firstTimeThisSession, track, type TrackEvent } from "../lib/track";

// Registra que se abrió una ficha (una vez por sesión: recargar no suma).
export default function TrackView({ type, id }: { type: TrackEvent; id: string | number }) {
  useEffect(() => {
    if (firstTimeThisSession(`${type}_${id}`)) track(type, id);
  }, [type, id]);
  return null;
}
