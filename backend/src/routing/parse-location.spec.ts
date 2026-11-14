import { parseLocationText } from './parse-location';

const point = (text: string) => {
  const parsed = parseLocationText(text);
  return parsed.kind === 'point' ? parsed.point : parsed.kind;
};

describe('parseLocationText', () => {
  it('coordenadas escritas, con distintos separadores', () => {
    expect(point('-25.312296, -57.601444')).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
    expect(point('-25.312296,-57.601444')).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
    expect(point('  -25.312296   -57.601444 ')).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
    expect(point('-25.312296; -57.601444')).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
  });

  it('coma decimal y signo menos tipográfico', () => {
    expect(point('-25,312296, -57,601444')).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
    expect(point('−25.312296, −57.601444')).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
    const nbsp = String.fromCharCode(0xa0); // espacio "duro" que pegan algunos teclados
    expect(point(`-25.312296${nbsp}-57.601444`)).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
    expect(point('-25.312296,\n-57.601444')).toEqual({
      lat: -25.312296,
      lng: -57.601444,
    });
  });

  it('grados, minutos y segundos (como los muestra Google Maps)', () => {
    const p = point(`25°18'44.3"S 57°36'05.2"W`) as {
      lat: number;
      lng: number;
    };
    expect(p.lat).toBeCloseTo(-25.312306, 5);
    expect(p.lng).toBeCloseTo(-57.601444, 5);
    // "O" de oeste, en español
    expect(
      (point(`25°18'44.3"S 57°36'05.2"O`) as { lng: number }).lng,
    ).toBeCloseTo(-57.601444, 5);
  });

  it('link largo de Google Maps: usa el último pin exacto (!3d/!4d), no el centro de la pantalla', () => {
    const link =
      "https://www.google.com/maps/place/25%C2%B018'44.3%22S+57%C2%B036'05.2%22W/@-25.3122948,-57.6020877,19z/data=!3m1!4b1!4m13!1m8!3m7!1s0x945da85e2ab4d5f5:0xf9f0f33cb998e9d!2sAztecas+877,+Asunci%C3%B3n+001231!3b1!8m2!3d-25.3121991!4d-57.601414!16s%2Fg%2F11x6mv7yfg!3m3!8m2!3d-25.312296!4d-57.601444?entry=ttu";
    expect(point(link)).toEqual({ lat: -25.312296, lng: -57.601444 });
  });

  it('ubicación compartida por WhatsApp (maps.google.com/?q=lat,lng)', () => {
    expect(
      point('https://maps.google.com/maps?q=-25.30123%2C-57.61234&z=17&hl=es'),
    ).toEqual({ lat: -25.30123, lng: -57.61234 });
  });

  it('link con texto alrededor, como se copia de un chat', () => {
    expect(
      point(
        'Esta es la ubicación del salón: https://www.google.com/maps?q=-25.29,-57.58 gracias!',
      ),
    ).toEqual({ lat: -25.29, lng: -57.58 });
    expect(parseLocationText('Acá: https://maps.app.goo.gl/AbC123.')).toEqual({
      kind: 'short-link',
      url: 'https://maps.app.goo.gl/AbC123',
    });
  });

  it('/place/lat,lng, /search/lat,lng y el destino de /dir/', () => {
    expect(
      point('https://www.google.com/maps/place/-25.3001,-57.6002'),
    ).toEqual({ lat: -25.3001, lng: -57.6002 });
    expect(
      point('https://www.google.com/maps/search/-25.3001,+-57.6002'),
    ).toEqual({ lat: -25.3001, lng: -57.6002 });
    expect(
      point(
        'https://www.google.com/maps/dir/-25.1,-57.1/-25.2,-57.2/@-25.15,-57.15,12z',
      ),
    ).toEqual({ lat: -25.2, lng: -57.2 });
    expect(
      point('https://www.google.com/maps/dir/?api=1&destination=-25.25,-57.55'),
    ).toEqual({ lat: -25.25, lng: -57.55 });
  });

  it('solo el centro de pantalla (@) como último recurso', () => {
    expect(
      point('https://www.google.com/maps/@-25.3122948,-57.6020877,19z'),
    ).toEqual({ lat: -25.3122948, lng: -57.6020877 });
  });

  it('Waze, Apple Maps y OpenStreetMap', () => {
    expect(point('https://waze.com/ul?ll=-25.31,-57.60&navigate=yes')).toEqual({
      lat: -25.31,
      lng: -57.6,
    });
    expect(point('https://maps.apple.com/?ll=-25.31,-57.60&q=Salon')).toEqual({
      lat: -25.31,
      lng: -57.6,
    });
    expect(
      point(
        'https://www.openstreetmap.org/?mlat=-25.31&mlon=-57.60#map=17/-25.31/-57.60',
      ),
    ).toEqual({ lat: -25.31, lng: -57.6 });
    expect(
      point('https://www.openstreetmap.org/#map=17/-25.31/-57.60'),
    ).toEqual({ lat: -25.31, lng: -57.6 });
  });

  it('página de consentimiento de Google: lee el link de "continue"', () => {
    const inner = encodeURIComponent(
      'https://www.google.com/maps/place/-25.3,-57.6',
    );
    expect(point(`https://consent.google.com/m?continue=${inner}`)).toEqual({
      lat: -25.3,
      lng: -57.6,
    });
  });

  it('links cortos: se devuelven para abrirlos (con o sin https://)', () => {
    expect(parseLocationText('https://maps.app.goo.gl/AbC123xyz')).toEqual({
      kind: 'short-link',
      url: 'https://maps.app.goo.gl/AbC123xyz',
    });
    expect(parseLocationText('mirá maps.app.goo.gl/AbC123xyz')).toEqual({
      kind: 'short-link',
      url: 'https://maps.app.goo.gl/AbC123xyz',
    });
  });

  it('link de mapa sin coordenadas', () => {
    expect(
      parseLocationText(
        'https://www.google.com/maps/place/Sal%C3%B3n+Los+Lapachos',
      ),
    ).toEqual({ kind: 'link-without-coords' });
  });

  it('texto que no es una ubicación', () => {
    expect(parseLocationText('')).toEqual({ kind: 'unrecognized' });
    expect(parseLocationText('Aztecas 877, Asunción 001231')).toEqual({
      kind: 'unrecognized',
    });
    expect(parseLocationText('hola')).toEqual({ kind: 'unrecognized' });
  });

  it('descarta coordenadas imposibles o el (0, 0) de "sin ubicación"', () => {
    expect(parseLocationText('-125.3, -57.6')).toEqual({
      kind: 'unrecognized',
    });
    expect(parseLocationText('0.0, 0.0')).toEqual({ kind: 'unrecognized' });
  });
});
