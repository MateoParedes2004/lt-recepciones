// Preguntas frecuentes del Home. Se muestran en la página y también se le
// pasan a Google como datos estructurados (FAQPage), así que el texto tiene
// que ser el mismo en los dos lados: por eso vive acá y no dentro del componente.
//
// Todo lo que dicen las respuestas ya lo afirma el sitio en otras partes
// (carrito con fechas y ciudad, pago por WhatsApp, horario, envío por zona).
// Si cambia una regla del negocio, hay que actualizarla también acá.

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaq(cityNames: string[]): FaqItem[] {
  const cities = cityNames.length
    ? ` Hoy entregamos en ${cityNames.length > 1 ? `${cityNames.slice(0, -1).join(", ")} y ${cityNames[cityNames.length - 1]}` : cityNames[0]}.`
    : "";

  return [
    {
      question: "¿Cómo hago un pedido?",
      answer:
        "Elegí los productos en nuestro catálogo, agregalos a tu cotización e indicá la ciudad de entrega. Con un toque enviás el pedido por WhatsApp y te respondemos para confirmar todo.",
    },
    {
      question: "¿Cómo sé si hay stock para la fecha de mi evento?",
      answer:
        "En tu cotización podés cargar la fecha del evento y la de devolución: el sistema te muestra al instante cuántas unidades hay libres para esas fechas.",
    },
    {
      question: "¿Hacen entregas? ¿Cuánto cuesta el envío?",
      answer: `Sí, entregamos y retiramos en Asunción y Gran Asunción. El costo depende de la ciudad y lo ves en tu cotización al elegirla; en algunas zonas se coordina por WhatsApp.${cities}`,
    },
    {
      question: "¿Cómo se paga y se confirma la reserva?",
      answer: "Los pagos y la confirmación de fechas se coordinan directamente por WhatsApp con nuestro equipo.",
    },
    {
      question: "¿Qué días atienden?",
      answer:
        "Atendemos de lunes a domingo. Si querés ver el mobiliario en persona, podés visitarnos en nuestras oficinas de Asunción previa cita.",
    },
    {
      question: "¿Para qué tipo de eventos alquilan?",
      answer:
        "Casamientos, cumpleaños, eventos corporativos y todo tipo de celebración, grandes o pequeños: sillas, mesas, mantelería, vajilla, cristalería, cubiertos y más.",
    },
  ];
}
