"""Run on a machine with the user's own authorized GitHub CLI login. Never force push."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def run(*args, check=True):
    return subprocess.run(args, cwd=ROOT, check=check, text=True, capture_output=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', default='hsushuhao-lab/clinic-kitchen-2')
    parser.add_argument('--create', action='store_true', help='Explicitly authorize private repository creation through your own gh login.')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repository):
        raise RuntimeError('Use owner/repository, not a URL.')
    if args.repository == 'hsushuhao-lab/hao_hw':
        raise RuntimeError('This publishes the independent package. Do not overwrite the old repository root.')
    for executable in ['git', 'gh']:
        if not shutil.which(executable):
            raise RuntimeError(f'{executable} is required on this machine.')
    run('gh', 'auth', 'status')
    print(run(sys.executable, 'tests/smoke_test.py').stdout.strip())
    print(run(sys.executable, 'tools/verify_assets.py').stdout.strip())
    meta = run('gh','repo','view',args.repository,'--json','nameWithOwner,isPrivate,defaultBranchRef',check=False)
    if meta.returncode:
        if not args.create:
            raise RuntimeError('Target not accessible. Create/authorize it first, or explicitly use --create with your own GitHub login.')
        run('gh','repo','create',args.repository,'--private','--description','Clinic Kitchen 2.0 — prototype, approved art and verified handoff')
        meta = run('gh','repo','view',args.repository,'--json','nameWithOwner,isPrivate,defaultBranchRef')
    if not json.loads(meta.stdout)['isPrivate']:
        raise RuntimeError('This migration requires a private target. No visibility changes were made.')
    if not (ROOT/'.git').exists():
        run('git','init','--initial-branch=main')
    if run('git','branch','--show-current').stdout.strip() != 'main':
        raise RuntimeError('Checkout main before publishing. No branch will be renamed or deleted automatically.')
    if (ROOT/'assets/reference/private').exists():
        raise RuntimeError('Remove private references from the source tree before publishing.')
    url = f'https://github.com/{args.repository}.git'
    origin = run('git','remote','get-url','origin',check=False)
    if origin.returncode:
        run('git','remote','add','origin',url)
    elif origin.stdout.strip() != url:
        raise RuntimeError(f'Origin is not {url}; refusing to replace it.')
    run('git','add','--all')
    staged = run('git','diff','--cached','--quiet',check=False)
    if staged.returncode == 1:
        run('git','commit','-m','Rebuild verified Clinic Kitchen R2 source and full-resolution art handoff')
    elif staged.returncode != 0:
        raise RuntimeError(staged.stderr)
    run('git','push','--set-upstream','origin','main')
    local = run('git','rev-parse','HEAD').stdout.strip()
    remote = run('git','ls-remote','origin','refs/heads/main').stdout.split()[0]
    if local != remote:
        raise RuntimeError('Remote main SHA differs from local HEAD.')
    branches = run('git','ls-remote','--heads','origin').stdout.strip().splitlines()
    if len(branches) != 1 or not branches[0].endswith('refs/heads/main'):
        raise RuntimeError('Push succeeded, but the target has other branches; review them before deleting anything.')
    run('gh','repo','edit',args.repository,'--default-branch','main')
    print(f'PUSH VERIFIED: {args.repository}/main @ {local}')
    print('Remote CI and browser deployment still require separate verification.')

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        if isinstance(error, subprocess.CalledProcessError):
            print(error.stderr, file=sys.stderr)
        else:
            print(str(error), file=sys.stderr)
        sys.exit(1)
