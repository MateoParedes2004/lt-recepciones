import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCheckoutIntentDto {
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsInt()
  @Min(1)
  itemCount: number;

  @IsOptional()
  @IsString()
  cityName?: string;
}
