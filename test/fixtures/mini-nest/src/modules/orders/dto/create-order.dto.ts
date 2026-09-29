import { IsInt, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  item!: string;

  @IsInt()
  qty!: number;
}
