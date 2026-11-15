import { IsIn } from 'class-validator';

export const STOP_ACTIONS = ['arrive', 'complete', 'reset'] as const;
export type StopAction = (typeof STOP_ACTIONS)[number];

export class UpdateStopDto {
  // arrive = "llegué" · complete = "listo" (entregado o retirado) · reset = deshacer.
  @IsIn(STOP_ACTIONS)
  action: StopAction;
}
