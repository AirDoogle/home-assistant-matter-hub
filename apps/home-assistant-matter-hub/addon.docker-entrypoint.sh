#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
set -e

# The bridge's storage (Matter fabrics and keys, bridge config) lives in the
# add-on's config folder and belongs to the unprivileged user that runs node.
storage=/config/data
mkdir -p "${storage}"
chown -R hamh:hamh "${storage}"
chmod 0700 "${storage}"

args=(
  start
  --log-level="$(bashio::config 'app_log_level' 'info')"
  --disable-log-colors="$(bashio::config 'disable_log_colors' 'false')"
  --storage-location="${storage}"
  --web-port="$(bashio::addon.ingress_port)"
  # The Supervisor's ingress proxy (172.30.32.2) reaches a host-network
  # add-on on the hassio bridge gateway; listen there only, and accept only
  # the proxy.
  --http-host=172.30.32.1
  --http-ip-whitelist=172.30.32.2
  --home-assistant-url=http://supervisor/core
)
if bashio::config.has_value 'mdns_network_interface'; then
  args+=(--mdns-network-interface="$(bashio::config 'mdns_network_interface')")
fi

# The token goes in through the environment (the CLI reads HAMH_* options),
# not argv, where any process in the container can read /proc/<pid>/cmdline.
export HAMH_HOME_ASSISTANT_ACCESS_TOKEN="${SUPERVISOR_TOKEN}"

# A heap cap that suits a 2 GB Home Assistant VM.
exec /command/s6-setuidgid hamh /usr/local/bin/node --max-old-space-size=256 \
  /app/apps/home-assistant-matter-hub/dist/backend/cli.js "${args[@]}"
