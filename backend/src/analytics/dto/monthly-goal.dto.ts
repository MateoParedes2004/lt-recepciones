import { IsInt, Max, Min, ValidateIf } from 'class-validator';

/** PUT /analytics/meta: meta de ingresos del mes en guaraníes; null la borra. */
export class MonthlyGoalDto {
  @ValidateIf((o: MonthlyGoalDto) => o.monto !== null)
  @IsInt({
    message: 'La meta tiene que ser un monto en guaraníes, sin decimales.',
  })
  @Min(1, { message: 'La meta tiene que ser mayor a cero.' })
  @Max(100_000_000_000, { message: 'La meta es demasiado grande.' })
  monto!: number | null;
}
