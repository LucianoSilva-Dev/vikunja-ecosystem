import axios from 'axios';
// @ts-ignore
import camelcaseKeys from 'camelcase-keys';
// @ts-ignore
import snakecaseKeys from 'snakecase-keys';

/**
 * Converts object keys to camelCase.
 * Handles Dates by keeping them as string (ISO) or Date objects.
 */
function convertObjectToCamel(o: any): any {
  if (o instanceof Date) {
    return o.toISOString();
  }
  if (Array.isArray(o)) {
    return o.map((i) => convertObjectToCamel(i));
  }
  if (o !== null && typeof o === 'object') {
    return camelcaseKeys(o, { deep: true });
  }
  return o;
}

/**
 * Converts object keys to snake_case.
 */
function convertObjectToSnake(o: any): any {
  if (o instanceof Date) {
    return o.toISOString();
  }
  if (Array.isArray(o)) {
    return o.map((i) => convertObjectToSnake(i));
  }
  if (o !== null && typeof o === 'object') {
    return snakecaseKeys(o, { deep: true });
  }
  return o;
}

export const AXIOS_INSTANCE = axios.create({
  baseURL: process.env.VIKUNJA_API_URL || '/api/v1',
});

// Response Interceptor: snake_case -> camelCase
AXIOS_INSTANCE.interceptors.response.use((response) => {
  if (response.data && typeof response.data === 'object') {
    // Need to handle Blob/File responses separately if needed,
    // but for JSON APIs this transformation is safe
    if (!(response.data instanceof Blob)) {
      response.data = convertObjectToCamel(response.data);
    }
  }
  return response;
});

// Request Interceptor: camelCase -> snake_case
AXIOS_INSTANCE.interceptors.request.use((config) => {
  if (
    config.data &&
    typeof config.data === 'object' &&
    !(config.data instanceof FormData)
  ) {
    config.data = convertObjectToSnake(config.data);
  }
  return config;
});

export const customInstance = <T>(config: any, options?: any): Promise<T> => {
  const source = axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};
