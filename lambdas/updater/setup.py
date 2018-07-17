from distutils.core import setup

install_requires = [
    'sentinel_s3',
    'requests',
    'elasticsearch'
]

setup(
    name='SatAPIUpdater',
    version='0.0.1',
    packages=[],
    install_requires=install_requires
)
