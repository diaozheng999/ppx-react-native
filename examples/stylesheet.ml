let%stylesheet p = {
  a = { c = d };
  b = [%style { c = d }];
  c = { c = d } [@unsafe];
  e;
}
