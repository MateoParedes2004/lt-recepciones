import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MANTELES_CATEGORY_NAME, acceptsColor, isManteles } from '../../common/categories';
import { RentalItemDto } from './create-rental.dto';

const parse = async (color: unknown) => {
  const dto = plainToInstance(RentalItemDto, {
    productId: 1,
    quantity: 2,
    color,
  });
  return { dto, errors: await validate(dto) };
};

describe('isManteles', () => {
  it('reconoce el rubro sin importar mayúsculas, tildes ni espacios', () => {
    expect(isManteles(MANTELES_CATEGORY_NAME)).toBe(true);
    expect(isManteles('manteles')).toBe(true);
    expect(isManteles('  MANTELES ')).toBe(true);
  });
  it('no confunde otros rubros ni valores vacíos', () => {
    expect(isManteles('Mantelería fina')).toBe(false);
    expect(isManteles('Sillas')).toBe(false);
    expect(isManteles('')).toBe(false);
    expect(isManteles(null)).toBe(false);
    expect(isManteles(undefined)).toBe(false);
  });
});

describe('acceptsColor', () => {
  it('lleva color: manteles (rubro) y servilletas (rubro o nombre del producto)', () => {
    expect(acceptsColor('Manteles', 'Mantel para Tablón')).toBe(true);
    expect(acceptsColor('Cubiertos y complementos', 'Servilletas')).toBe(true);
    expect(acceptsColor('Cubiertos y complementos', '  SERVILLETA de tela ')).toBe(true);
    expect(acceptsColor('Servilletas', 'Lino')).toBe(true);
  });
  it('no lleva color: el resto', () => {
    expect(acceptsColor('Sillas', 'Sillas Tiffany')).toBe(false);
    expect(acceptsColor('Cubiertos y complementos', 'Tenedor Acero Inox')).toBe(false);
    expect(acceptsColor(null, undefined)).toBe(false);
  });
});

describe('RentalItemDto.color', () => {
  it('es opcional: sin color o con color vacío queda sin color', async () => {
    expect((await parse(undefined)).errors).toHaveLength(0);
    for (const vacio of ['', '   ', '\n\t', null]) {
      const { dto, errors } = await parse(vacio);
      expect(errors).toHaveLength(0);
      expect(dto.color).toBeNull();
    }
  });

  it('limpia espacios y saltos de línea, y deja la ñ como ñ', async () => {
    expect((await parse('  Azul   marino ')).dto.color).toBe('Azul marino');
    expect((await parse('Azul\nmarino')).dto.color).toBe('Azul marino');
    expect((await parse('ñu')).dto.color).toBe('ñu');
  });

  it('acepta hasta 40 caracteres y rechaza 41', async () => {
    expect((await parse('x'.repeat(40))).errors).toHaveLength(0);
    expect((await parse('x'.repeat(41))).errors).not.toHaveLength(0);
  });

  it.each([123, true, { a: 1 }, ['Negro']])(
    'rechaza lo que no es texto: %p',
    async (valor) => {
      expect((await parse(valor)).errors).not.toHaveLength(0);
    },
  );
});
