// Datos del emisor tal como figuran en el talonario de papel vigente (timbrado
// 18622524). Solo se usan para crear la fila de InvoiceSettings la primera vez:
// después se editan desde el panel (pestaña Factura Electrónica). El timbrado
// queda vacío a propósito: el electrónico lo asigna la DNIT al habilitarse.
export const ISSUER_DEFAULTS = {
  businessName: 'MATEO ABRAHAN PAREDES ROMAN',
  tradeName: 'LT Recepciones',
  slogan: 'Servicio integral de alquileres para fiestas',
  ruc: '5726203-9',
  activities: [
    'Comercio al por mayor de bebidas',
    'Otras actividades de servicios personales N.C.P.',
    'Otras actividades de servicios de apoyo a empresas N.C.P.',
    'Otros servicios de suministro de alimento para consumo inmediato N.C.P.',
  ].join('\n'),
  address:
    'Cnel. Gaudioso Núñez Nº 961 entre Celsa Speratti y Azara, Barrio Mburicao',
  city: 'Asunción',
  phone: '(0985) 86 77 49',
  email: '',
  establishment: '001',
  expeditionPoint: '001',
  timbrado: '',
};
