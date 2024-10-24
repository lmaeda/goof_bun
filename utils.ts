// utils.ts

export const ran_no = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const uid = (len: number): string => {
  let str = '';
  const src = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const src_len = src.length;

  for (let i = len; i--; ) {
    str += src.charAt(ran_no(0, src_len - 1));
  }

  return str;
};

export const forbidden = (res: any): void => { // Replace 'any' with the appropriate response object type from your framework
  const body = 'Forbidden';
  res.statusCode = 403;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', body.length);
  res.end(body);
};
