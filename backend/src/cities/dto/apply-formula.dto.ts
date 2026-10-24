import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class ApplyFormulaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  ids: number[];
}
