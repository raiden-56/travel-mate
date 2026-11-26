import type { ApiProblem } from "@/types/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: { field: string; message: string }[];

  constructor(problem: ApiProblem) {
    super(problem.detail || problem.title || "Something went wrong");
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code ?? (problem.status === 0 ? "NETWORK" : "UNKNOWN");
    this.fieldErrors = problem.errors ?? [];
  }

  get isNotFound() {
    return this.status === 404;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isNetwork() {
    return this.status === 0;
  }
}
