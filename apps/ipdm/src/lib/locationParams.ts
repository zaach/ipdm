const RELAY_REGEX = /;?r=([^;]+)/;

export function getInvite(hash?: string) {
  const res = hash?.slice(1).replace(RELAY_REGEX, "");
  console.log("get invite", res);
  return res;
}

export function getRelayAddr(hash?: string) {
  const result = hash?.match(RELAY_REGEX);
  console.log("get relay", result);
  if (result && result.length > 1) {
    return result[1];
  }
}
