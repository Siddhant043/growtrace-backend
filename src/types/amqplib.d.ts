declare module 'amqplib' {
  export interface RabbitMQConnection {
    close(): Promise<void>
  }

  export function connect(url: string): Promise<RabbitMQConnection>
}
