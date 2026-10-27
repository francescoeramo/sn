#!/usr/bin/env python3
"""Prepare the private LAN backend and the matching iOS development configuration."""
import argparse
import ipaddress
import json
import plistlib
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parent.parent
PRIVATE = tuple(ipaddress.ip_network(value) for value in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def command(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True, stderr=subprocess.PIPE, timeout=30).strip()


def select_host(configured, interfaces, routes, explicit=None, device=None):
    available = {}
    for interface in interfaces:
        if device and interface['ifname'] != device:
            continue
        if 'UP' not in interface.get('flags', []):
            continue
        for entry in interface.get('addr_info', []):
            address = ipaddress.ip_address(entry['local'])
            if any(address in subnet for subnet in PRIVATE):
                available[str(address)] = interface['ifname']
    if explicit:
        if explicit not in available:
            raise ValueError('Host non assegnato a un’interfaccia privata attiva.')
        return explicit
    if configured in available:
        return configured
    default_devices = {route['dev'] for route in routes if route.get('dst') == 'default' and 'dev' in route}
    candidates = [host for host, device in available.items() if device in default_devices]
    if len(candidates) != 1:
        raise ValueError('Rete ambigua: specificare --host con un indirizzo privato del computer.')
    return candidates[0]


def update_config(path, host):
    original = path.read_bytes()
    config = plistlib.loads(original)
    url = urlsplit(config['SNApiBaseURL'])
    if url.scheme != 'http' or url.port != 3000 or url.path not in ('', '/'):
        raise ValueError('Configurazione diversa dal backend locale HTTP:3000; nessuna modifica automatica.')
    if url.hostname == host:
        return False
    # Preserve comments and formatting; change only the URL and its specific ATS key.
    text = original.decode()
    old_url = config['SNApiBaseURL']
    old_key = '<key>' + url.hostname + '</key>'
    if text.count(old_key) != 1 or text.count(old_url) != 1:
        raise ValueError('Eccezione ATS specifica mancante o ambigua.')
    updated = text.replace(old_url, 'http://' + host + ':3000').replace(old_key, '<key>' + host + '</key>')
    plistlib.loads(updated.encode())
    path.write_text(updated)
    return True


def backend_ready(host):
    try:
        # No credentials, proxies or redirects: expect the unauthenticated SN response.
        with build_opener(ProxyHandler({}), NoRedirect()).open('http://' + host + ':3000/api/bootstrap', timeout=3):
            return False
    except HTTPError as error:
        return error.code == 401
    except (URLError, TimeoutError, OSError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', help='Private IPv4 assigned to this computer; otherwise reuse/detect it')
    parser.add_argument('--interface', help='Use only this network interface; never fall back to another network')
    parser.add_argument('--check', action='store_true', help='Diagnose only; do not modify files or services')
    parser.add_argument('--install', action='store_true', help='Build, sign and install via USB after preparing the backend')
    args = parser.parse_args()
    try:
        path = ROOT / 'ios/SN/Info.plist'
        configured = urlsplit(plistlib.loads(path.read_bytes())['SNApiBaseURL']).hostname
        host = select_host(configured, json.loads(command('ip', '-j', '-4', 'address')),
                           json.loads(command('ip', '-j', '-4', 'route')), args.host, args.interface)
        if args.check:
            ready = configured == host and backend_ready(host)
            print('Ambiente iOS: ' + ('pronto' if ready else 'da preparare') + ' · ' + host)
            return 0 if ready else 1
        # Do not stop a service from another checkout or an unrelated command.
        state = command('systemctl', '--user', 'show', 'sn-ios-dev.service',
                        '-p', 'ActiveState', '-p', 'WorkingDirectory', '-p', 'ExecStart')
        active = 'ActiveState=active' in state or 'ActiveState=activating' in state
        if active and ('WorkingDirectory=' + str(ROOT) + '\n' not in state + '\n'
                       or 'node_modules/next/dist/bin/next dev ' not in state):
            raise ValueError('sn-ios-dev appartiene a un altro processo o checkout; servizio conservato.')
        changed = update_config(path, host)
        if active and '--hostname ' + host + ' --port 3000' not in state:
            command('systemctl', '--user', 'stop', 'sn-ios-dev.service')
            active = False
        if not active:
            node = shutil.which('node')
            if not node:
                raise ValueError('Node non disponibile.')
            command('systemd-run', '--user', '--unit=sn-ios-dev', '--collect',
                    '--property=Restart=on-failure', '--working-directory=' + str(ROOT),
                    node, 'node_modules/next/dist/bin/next', 'dev', '--hostname', host, '--port', '3000')
        for _ in range(20):
            if backend_ready(host):
                break
            time.sleep(1)
        else:
            raise ValueError('Backend non pronto: consultare journalctl --user -u sn-ios-dev.')
        print('Backend pronto · http://' + host + ':3000', flush=True)
        if args.install:
            log = ROOT / '.impeccable/review/ios-install.log'
            log.parent.mkdir(parents=True, exist_ok=True)
            with log.open('w') as stream:
                result = subprocess.run(['xtool', 'dev', 'run', '--usb'], cwd=ROOT / 'ios',
                                        stdout=stream, stderr=subprocess.STDOUT, timeout=900)
            if result.returncode or '[Verifying] 100%' not in log.read_text():
                raise ValueError('Installazione non verificata; dettagli in ' + str(log.relative_to(ROOT)))
            print('Installazione USB verificata; aprire SN.')
        elif changed:
            print('IP aggiornato: eseguire con --install per aggiornare anche l’app sul telefono.')
        return 0
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as error:
        print('Ambiente iOS: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
