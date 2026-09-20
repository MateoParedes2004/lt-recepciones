import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCheckoutIntentDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  totalAmount: number;

  @IsInt()
  @Min(1)
  @Max(100_000)
  itemCount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cityName?: string;
}
