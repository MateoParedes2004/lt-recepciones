// Actualiza SOLO la descripción de los productos del catálogo (no toca precio,
// stock, foto, nombre ni rubro). Pensado para correrlo una vez contra
// producción, con tu usuario de administrador:
//
//   Simulación (no escribe nada, muestra qué cambiaría):
//     ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='tu-clave' node prisma/update-product-descriptions.mjs
//
//   Aplicar de verdad:
//     ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='tu-clave' node prisma/update-product-descriptions.mjs --yes
//
// API_URL (opcional) apunta a otro backend; por defecto es el de producción.
//
// Seguridad: cada descripción se aplica por id, pero solo si el nombre del
// producto en esa base coincide con el esperado (así un id distinto en otra
// base nunca pisa el producto equivocado). Los que no coinciden se saltean.

const API_URL = (process.env.API_URL || 'https://lt-recepciones-api.onrender.com').replace(/\/$/, '');
const write = process.argv.includes('--yes');

// id → { names: nombres aceptados, description }
// Solo hechos que el sitio ya conoce (nombre, descripción anterior, capacidad
// de las mesas): sin medidas ni materiales inventados.
const PRODUCTS = [
  { id: 77, names: ['Silla Plástica con Poza Brazos para Niños', 'Silla Plástica con Posa Brazos para Niños'], description: 'Silla plástica con apoyabrazos en tamaño para niños, pensada para que los más chicos coman y jueguen cómodos en cumpleaños y fiestas infantiles. Armá el rincón infantil combinándola con nuestras mesas redondas infantiles.' },
  { id: 76, names: ['Caminero'], description: 'Caminero de tela para decorar y realzar el centro de la mesa. Se coloca a lo largo de la mesa sobre el mantel y sirve de base para centros de mesa, velas o flores, sumando un detalle de ambientación a casamientos, cumpleaños y eventos.' },
  { id: 75, names: ['Mantel'], description: 'Mantel de tela para vestir la mesa, parte esencial de la ambientación de tu evento. Pedí uno por mesa y combinalo con camineros, servilletas de tela y posaplatos para lograr un montaje prolijo y completo.' },
  { id: 74, names: ['Mantelón'], description: 'Mantelón de tela para cubrir mesas más grandes con la misma prolijidad que el mantel estándar. Es la opción para tablones, mesas largas y mesas de buffet, de regalos o de postres.' },
  { id: 73, names: ['Pinza para Hielo'], description: 'Pinza para servir hielo con comodidad e higiene, sin usar las manos. Imprescindible en la barra de tu evento, junto al tacho para bebidas y la champañera.' },
  { id: 61, names: ['Copa para Agua'], description: 'Copa de cristal para agua, parte del juego completo de copas para tu mesa. Se combina con las copas para vino y para champán para presentar una mesa de casamiento o de evento formal bien servida.' },
  { id: 60, names: ['Mesa Cuadrada x10'], description: 'Mesa cuadrada con capacidad para 10 personas, práctica para armar el salón en casamientos, cumpleaños y eventos de empresa. Pedila con manteles y sillas para tener todo el montaje resuelto en un solo alquiler.' },
  { id: 59, names: ['Mesa Redonda x12'], description: 'Mesa redonda con capacidad para 12 personas, perfecta como mesa principal o de honor. Con un mantel y un centro de mesa se convierte en el punto de atención de casamientos y cumpleaños de 15.' },
  { id: 58, names: ['Mesa Redonda x6'], description: 'Mesa redonda con capacidad para 6 personas, ideal para armar varias mesas en el salón y que los invitados conversen cómodos. Una buena opción para cumpleaños y reuniones familiares.' },
  { id: 57, names: ['Silla Cromada Plegadizo', 'Silla Cromada Plegable'], description: 'Silla cromada plegable, práctica para sumar asientos extra cuando hace falta. Al plegarse es fácil de transportar y de guardar, ideal para completar lugares en cumpleaños, reuniones y eventos.' },
  { id: 56, names: ['Bandeja para Ensaladas'], description: 'Bandeja amplia para servir ensaladas en la mesa o en el buffet de tu evento. Mantiene la presentación prolija y facilita que cada invitado se sirva con comodidad.' },
  { id: 55, names: ['Bandeja para Mozo'], description: 'Bandeja para mozo, práctica para trasladar platos y bebidas durante el servicio. Ayuda a atender con más comodidad y seguridad en eventos con muchos invitados.' },
  { id: 54, names: ['Cuchara de Sopa'], description: 'Cuchara de sopa, ideal para entradas y platos con caldo. Pedí la cantidad según tus invitados, junto con los platos hondos y el resto del juego de cubiertos.' },
  { id: 53, names: ['Tenedor Grande'], description: 'Tenedor grande para servir ensalada u otros platos del buffet. Funciona como cubierto de servicio para que los invitados se sirvan con comodidad.' },
  { id: 52, names: ['Cuchara Grande'], description: 'Cuchara grande para servir ensalada u otros platos del buffet. Funciona como cubierto de servicio para que los invitados se sirvan con comodidad.' },
  { id: 51, names: ['Tenedores de Postre', 'Tenedor de Postre'], description: 'Tenedor de postre, parte del juego de cubiertos para el cierre dulce de tu evento. Va muy bien con los platitos de postre y las compoteras.' },
  { id: 50, names: ['Cuchara de Postre'], description: 'Cuchara de postre, parte del juego de cubiertos para el cierre dulce de tu evento. Ideal para helados y postres servidos en compotera.' },
  { id: 49, names: ['Tenedor Acero Inox'], description: 'Tenedor de acero inoxidable, parte del juego principal de cubiertos. Resistente y de aspecto prolijo, combina con el cuchillo de acero inoxidable para el plato principal.' },
  { id: 48, names: ['Cuchillo Acero Inox'], description: 'Cuchillo de acero inoxidable, parte del juego principal de cubiertos. Resistente y de aspecto prolijo, combina con el tenedor de acero inoxidable para el plato principal.' },
  { id: 47, names: ['Tenedor de Mesa de 1°'], description: 'Tenedor de mesa, parte del juego principal de cubiertos para tu evento. Se alquila por unidad: pedí la cantidad según tus invitados y combinalo con el cuchillo de mesa.' },
  { id: 46, names: ['Cuchillo de Mesa de 1°'], description: 'Cuchillo de mesa, parte del juego principal de cubiertos para tu evento. Se alquila por unidad: pedí la cantidad según tus invitados y combinalo con el tenedor de mesa.' },
  { id: 45, names: ['Tenedor Mango Madera'], description: 'Tenedor con mango de madera, suma un detalle cálido y natural a la mesa. Queda muy bien en eventos de estilo rústico o campestre, junto con sillas de madera y posaplatos de rattan.' },
  { id: 44, names: ['Cuchillo Mango Madera'], description: 'Cuchillo con mango de madera, suma un detalle cálido y natural a la mesa. Queda muy bien en eventos de estilo rústico o campestre, junto con sillas de madera y posaplatos de rattan.' },
  { id: 43, names: ['Tenedor Mango Blanco'], description: 'Tenedor con mango blanco, una opción prolija para el servicio de mesa. Su color claro combina con vajilla blanca y con mantelería de cualquier tono.' },
  { id: 42, names: ['Cuchillo Mango Blanco'], description: 'Cuchillo con mango blanco, una opción prolija para el servicio de mesa. Su color claro combina con vajilla blanca y con mantelería de cualquier tono.' },
  { id: 41, names: ['Compotera'], description: 'Compotera para servir helado y postres, ideal para la mesa dulce o para el cierre de tu evento. Combina con las cucharas y los tenedores de postre.' },
  { id: 40, names: ['Platito Cuadrado'], description: 'Platito cuadrado, una opción moderna para servir el postre o el acompañamiento. Hace juego con el plato cuadrado para una mesa de líneas modernas.' },
  { id: 39, names: ['Platito Borde Dorado'], description: 'Platito con borde dorado, un detalle elegante para la mesa de postre. Hace juego con el plato de borde dorado y con las sillas Tiffany doradas.' },
  { id: 38, names: ['Platito Blanco'], description: 'Platito blanco para postre o acompañamiento, para redondear la vajilla de tu mesa. Combina con el plato redondo blanco y con cualquier estilo de decoración.' },
  { id: 37, names: ['Plato Hondo'], description: 'Plato hondo, ideal para sopas, pastas o platos principales en tu evento. Se completa con cuchara de sopa y el resto del juego de cubiertos.' },
  { id: 36, names: ['Plato Borde Dorado'], description: 'Plato con borde dorado, suma un toque elegante al plato principal. Queda muy bien en casamientos y cumpleaños de 15, junto con posaplatos dorados y sillas Tiffany doradas.' },
  { id: 35, names: ['Plato Cuadrado'], description: 'Plato cuadrado, una opción moderna para darle otro estilo a la presentación de tu mesa. Combina con el platito cuadrado para una vajilla de líneas modernas.' },
  { id: 34, names: ['Plato Redondo Blanco'], description: 'Plato redondo blanco clásico, la base de la vajilla para el plato principal. Sirve para cualquier tipo de evento y combina con todos los estilos de decoración.' },
  { id: 30, names: ['Parrillita'], description: 'Parrillita compacta, práctica para reuniones más chicas o espacios reducidos. Una opción simple para asar en cumpleaños y encuentros al aire libre cuando no hace falta una parrilla grande.' },
  { id: 29, names: ['Parrilla para Asado'], description: 'Parrilla para asado, ideal para la comida de tu evento al aire libre. Pensada para encuentros con muchos invitados; conviene reservarla con tiempo para asegurar la fecha.' },
  { id: 28, names: ['Silla Tiffany Dorada'], description: 'Silla Tiffany dorada, suma un brillo elegante a la decoración de tu evento. Ideal para casamientos, cumpleaños de 15 y eventos de gala, donde se luce tanto en la ceremonia como en la recepción.' },
  { id: 27, names: ['Silla Tifanny Blanca', 'Silla Tiffany Blanca'], description: 'Silla Tiffany blanca, un clásico elegante para casamientos y eventos formales. Su diseño y su color blanco combinan con cualquier decoración y resaltan la mantelería de colores.' },
  { id: 26, names: ['Silla de Madera'], description: 'Silla de madera, una opción cálida y resistente para tu evento. Funciona muy bien en casamientos al aire libre, almuerzos y celebraciones de estilo rústico, junto con posaplatos de rattan.' },
  { id: 25, names: ['Silla plástica con Posa Brazos', 'Silla Plástica con Posa Brazos'], description: 'Silla plástica con apoyabrazos, suma comodidad extra a tus invitados. Una buena alternativa para eventos largos como casamientos, cumpleaños y reuniones de empresa.' },
  { id: 24, names: ['Silla Plástica sin Posa Brazos'], description: 'Silla plástica sin apoyabrazos, una opción económica y resistente para eventos grandes. Práctica para completar muchos asientos en cumpleaños, fiestas y reuniones con muchos invitados.' },
  { id: 23, names: ['Tacho para Bebidas'], description: 'Tacho para bebidas con hielo, práctico para la barra de tu evento. Mantiene frías las bebidas al alcance de los invitados y se completa con la pinza para hielo.' },
  { id: 22, names: ['Champañera'], description: 'Champañera para mantener frío el espumante o las bebidas durante el evento. Un detalle infaltable para el brindis en casamientos, cumpleaños de 15 y celebraciones.' },
  { id: 21, names: ['Posa Plato Dorado'], description: 'Posa plato dorado, le da un toque elegante a cada puesto de mesa. Combina con vajilla de borde dorado y con las sillas Tiffany doradas.' },
  { id: 20, names: ['Posa Plato Rattan'], description: 'Posa plato de rattan, suma un estilo natural y cálido a la mesa. Queda muy bien con sillas de madera y cubiertos de mango de madera en eventos de estilo rústico.' },
  { id: 19, names: ['Servilletas'], description: 'Servilletas de tela para completar la mesa con un detalle prolijo. Combinan con el mantel y el caminero para un montaje cuidado en casamientos y eventos formales.' },
  { id: 13, names: ['Tablón'], description: 'Tablón rectangular donde entran de 8 a 10 personas, versátil para buffet, mesa de regalos, mesa dulce o para armar mesas largas corridas. Con un mantel o un mantelón queda prolijo en cualquier evento.' },
  { id: 12, names: ['Mesa Redonda Infantil'], description: 'Mesa redonda de tamaño infantil, pensada para cumpleaños de niños. Junto con las sillas para niños arma el rincón de los más chicos en fiestas y cumpleaños.' },
  { id: 11, names: ['Mesa Redonda x8'], description: 'Mesa redonda con capacidad para 8 personas, una medida versátil para casamientos, cumpleaños y eventos. Con mantel y sillas queda lista para recibir a tus invitados.' },
  { id: 10, names: ['Mesa Cuadrada x8'], description: 'Mesa cuadrada con capacidad para 8 personas, cómoda para reuniones familiares o sociales. Pedila con manteles y sillas para tener el montaje resuelto en un solo alquiler.' },
  { id: 8, names: ['Copa para Vino'], description: 'Copa de cristal para vino, ideal para completar el servicio de mesa de tu evento. Va bien con las copas para agua y para champán en cenas y almuerzos formales.' },
  { id: 7, names: ['Copa Gran Vino'], description: 'Copa amplia para vino tinto, pensada para resaltar el aroma en una mesa bien servida. Una opción de presencia para cenas de casamiento y eventos formales.' },
  { id: 6, names: ['Copa Champán'], description: 'Copa alta para champán o espumante, infaltable para el brindis de tu celebración. Ideal para casamientos, cumpleaños de 15 y fiestas de fin de año.' },
  { id: 5, names: ['Copa Barroca Verde'], description: 'Copa de cristal con base verde, estilo barroco, ideal para dar un toque elegante a la mesa. Suma color a la mesa y se luce con mantelería blanca o dorada.' },
  { id: 4, names: ['Copa Barroca Ámbar'], description: 'Copa de cristal con base ámbar, estilo barroco, perfecta para sumar color y distinción a tu evento. Se luce con mantelería blanca o dorada y vajilla de borde dorado.' },
  { id: 1, names: ['Vaso Multiuso'], description: 'Vaso multiuso resistente, práctico para bebidas frías o calientes durante todo el evento. Sirve para agua, gaseosas, jugos o café en cumpleaños y reuniones.' },
];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (write && (!email || !password)) {
    console.error('Para aplicar los cambios hace falta ADMIN_EMAIL y ADMIN_PASSWORD (tu usuario del panel).');
    process.exit(1);
  }

  const res = await fetch(`${API_URL}/products`);
  if (!res.ok) throw new Error(`No se pudo leer el catálogo (${res.status}).`);
  const current = new Map((await res.json()).map((p) => [p.id, p]));

  let token = null;
  if (write) {
    const login = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) throw new Error(`No se pudo iniciar sesión (${login.status}). Revisá el correo y la contraseña.`);
    token = (await login.json()).token;
  }

  let changed = 0, same = 0, skipped = 0, failed = 0;
  for (const item of PRODUCTS) {
    const p = current.get(item.id);
    if (!p) { console.log(`- #${item.id} ${item.names[0]}: no existe en esta base, se saltea.`); skipped++; continue; }
    if (!item.names.some((n) => norm(n) === norm(p.name))) {
      console.log(`- #${item.id}: el nombre es "${p.name}" y se esperaba "${item.names[0]}": se saltea por seguridad.`);
      skipped++;
      continue;
    }
    if ((p.description ?? '').trim() === item.description) { same++; continue; }

    console.log(`\n#${item.id} ${p.name}\n  antes:   ${p.description || '(sin descripción)'}\n  después: ${item.description}`);
    if (!write) { changed++; continue; }

    const put = await fetch(`${API_URL}/products/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: item.description }),
    });
    if (put.ok) changed++;
    else { failed++; console.log(`  ✗ no se pudo guardar (${put.status}): ${await put.text()}`); }
  }

  console.log(`\n${write ? 'Aplicado' : 'Simulación'}: ${changed} ${write ? 'actualizados' : 'cambiarían'}, ${same} ya estaban igual, ${skipped} salteados${failed ? `, ${failed} con error` : ''}.`);
  if (!write && changed > 0) console.log('Para aplicarlo de verdad, volvé a correrlo agregando --yes');
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
