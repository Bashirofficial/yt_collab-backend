import { serializeBigInt } from "./serialization.util";
class ApiResponse<T = any> {
  public statusCode: number;
  public data: T;
  public message: string;
  public success: boolean;

  constructor(statusCode: number, data: T, message = "Success") {
    this.statusCode = statusCode;
    this.data = serializeBigInt(data);
    this.message = message;
    this.success = statusCode < 400;
  }
}

export { ApiResponse };
