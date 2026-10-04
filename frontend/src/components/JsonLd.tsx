// Datos estructurados (schema.org) para Google. Los textos salen de la base
// de datos (nombres y descripciones de productos), así que se escapa "<": un
// nombre con "</script>" no puede cortar la etiqueta ni inyectar código.
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
