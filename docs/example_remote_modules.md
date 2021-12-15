# Example Remote Modules

Contains a list of example remote modules.

## Log every message

Logs every message. Mostly useful to make sure remote modules are working.

Add the following to your modules array:
```json
{
  "id": "remote-module",
  "source": {
    "source": "remote",
    "url": "https://cdn.iamtheyammer.com/omnibot/modules/remote_module.json"
  }
}
```

## Filesystem API test

Tests filesystem APIs. Doesn't interact with Discord at all.

```json
{
  "id": "fs-test",
  "source": {
    "source": "remote",
    "url": "https://cdn.iamtheyammer.com/omnibot/modules/fs-test/config.json"
  }
}
```
