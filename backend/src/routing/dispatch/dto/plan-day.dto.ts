import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  MAX_TRAFFIC_FACTOR,
  MAX_VEHICLES,
  MIN_TRAFFIC_FACTOR,
} from '../dispatch';

export class PlanDayDto {
  // Día del reparto: AAAA-MM-DD (fecha de calendario de Paraguay).
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato AAAA-MM-DD',
  })
  date: string;

  // Cantidad de camiones disponibles ese día.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VEHICLES)
  vehicles?: number;

  // Hora de salida del depósito, "HH:MM" (hora de Paraguay).
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime debe tener formato HH:MM',
  })
  startTime?: string;

  // Multiplicador de los tiempos de viaje por tráfico (1 = sin tráfico).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_TRAFFIC_FACTOR)
  @Max(MAX_TRAFFIC_FACTOR)
  trafficFactor?: number;

  @IsOptional()
  @IsBoolean()
  includeDeliveries?: boolean;

  @IsOptional()
  @IsBoolean()
  includePickups?: boolean;

  // true = además de calcular, guarda la ruta del día (reemplaza la anterior).
  @IsOptional()
  @IsBoolean()
  save?: boolean;

  // true = permite reemplazar una ruta guardada que ya tiene paradas marcadas
  // como "llegué" o "listo".
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}
