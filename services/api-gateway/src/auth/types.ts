export type AuthenticatedUser = {
  sub: string;
  username: string;
  roles: string[];
};

export type DemoUser = {
  username: string;
  password: string;
  subject: string;
  roles: string[];
};
