import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  status!: string;

  @Column({ type: 'int' })
  amount!: number;

  createdLabel?: string;
}
