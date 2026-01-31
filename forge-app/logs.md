
Copyright (C) Microsoft Corporation. All rights reserved.

Install the latest PowerShell for new features and improvements! https://aka.ms/PSWindows

PS C:\Users\VishnuK> cd C:\ATG\jira4\JIRAForge\forge-app
PS C:\ATG\jira4\JIRAForge\forge-app> forge deploy --verbose
Warning: Forge CLI supports Node.js 20.x or 22.x.
Unsupported Node.js versions are not guaranteed to work correctly.

Warning: Your version of Forge CLI is out of date. We recommend you update to the latest version to get the latest features and bug fixes.
Run npm install -g @forge/cli@latest to update from version 12.13.0 to 12.13.1.

▶️  GraphQL https://api.atlassian.com/graphql
Query:
      query forge_cli_getApplicationEnvironmentId($id: ID!, $key: String!) {
        app(id: $id) {
          name
          environmentByKey(key: $key) {
            id
            type
          }
        }
      }

Variables: {
  "id": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "key": "default"
}
◀️  GraphQL
Request ID: be7b8dd2-5ac9-4d48-b4a8-91f571f0feb8
Result: {
  "app": {
    "name": "Time Tracker",
    "environmentByKey": {
      "id": "51a33afd-8063-435e-9b4b-846eb64f676f",
      "type": "DEVELOPMENT"
    }
  }
}
Deploying your app to the development environment.
Press Ctrl+C to cancel.

Running forge lint...
No issues found.

▶️  GraphQL https://api.atlassian.com/graphql
Query:
          query forge_cli_getMigrationKeys($id: ID!, $key: String!) {
            app(id: $id) {
              environmentByKey(key: $key) {
                id
                versions(first: 1) {
                  edges {
                    node {
                      isLatest
                      migrationKeys {
                        jira
                        confluence
                      }
                      version
                    }
                  }
                }
              }
              marketplaceApp { appKey }
            }
          }

Variables: {
  "id": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "key": "default"
}
◀️  GraphQL
Request ID: 7ae1fb34-133f-4b9a-b309-87642a439f9f
Result: {
  "app": {
    "environmentByKey": {
      "id": "51a33afd-8063-435e-9b4b-846eb64f676f",
      "versions": {
        "edges": [
          {
            "node": {
              "isLatest": true,
              "migrationKeys": null,
              "version": "4.110.0"
            }
          }
        ]
      }
    },
    "marketplaceApp": null
  }
}
▶️  GraphQL https://api.atlassian.com/graphql
Query:
      query forge_cli_hasNoAppInstallationsForEnv($filter: AppInstallationsByAppFilter!) {
        ecosystem {
          appInstallationsByApp(filter: $filter, first: 1) {
            totalCount
          }
        }
      }

Variables: {
  "filter": {
    "apps": {
      "ids": [
        "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a"
      ]
    },
    "appEnvironments": {
      "types": [
        "DEVELOPMENT"
      ]
    }
  }
}
◀️  GraphQL
Request ID: c7f98372-7dea-4b6c-84e8-91a5dd01346a
Result: {
  "ecosystem": {
    "appInstallationsByApp": {
      "totalCount": 1
    }
  }
}
Deploying Time Tracker to development...

i Packaging app files
  Packaging bundled files
  , from __forge__.cjs
  , from __forge_wrapper__.cjs
  , from index.cjs
  , from index.cjs.map
  , from runtime.json
  , from manifest.yml
  , from package.json
  , from package-lock.json
  Archive created: C:\Users\VishnuK\AppData\Local\Temp\tmp-21328-x7it4vfx1I8U-.zip
  , from asset-manifest.json
  , from static\css\main.a9587b35.css
  , from static\js\main.cbf19801.js.LICENSE.txt
  , from static\css\main.a9587b35.css.map
  , from index.html
  , from static\js\main.cbf19801.js
  , from index.html
  , from static\css\main.ff637727.css.map
  , from asset-manifest.json
  , from static\css\main.ff637727.css
  , from static\js\main.0afdce88.js.LICENSE.txt
  , from static\js\main.0afdce88.js.map
  , from static\js\main.0afdce88.js
  , from static\js\main.cbf19801.js.map
i Uploading app
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
      mutation forge_cli_getDeploymentUrl($input: CreateAppDeploymentUrlInput!) {
        createAppDeploymentUrl(input: $input) {
          success
          errors {
            message
            extensions {
              errorType
              statusCode
            }
          }
          deploymentUrl
        }
      }

Variables: {
  "input": {
    "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a"
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
      mutation forge_cli_getHostedResourcesUploadUrls($input: CreateHostedResourceUploadUrlInput!) {
        createHostedResourceUploadUrl(input: $input) {
          success
          errors {
            message
            extensions {
              errorType
              statusCode
            }
          }
          preSignedUrls {
            uploadUrl
            uploadFormData
          }
          uploadId
        }
      }

Variables: {
  "input": {
    "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
    "environmentKey": "default",
    "resourceKeys": [
      "settings",
      "main"
    ]
  }
}
  ◀️  GraphQL
Request ID: f91d9bbe-6037-4209-a482-48cdbdb9d2e0
Result: {
  "createAppDeploymentUrl": {
    "success": true,
    "errors": null,
    "deploymentUrl": "https://deployment-artifacts-372253104996-us-west-2.s3.us-west-2.amazonaws.com/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a_0e8d5f11-0ddb-421f-8bf4-e5560686639e?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAVNLADTNSKN2PASHK%2F20260131%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20260131T221330Z&X-Amz-Expires=300&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPb%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLXdlc3QtMiJGMEQCIBHgOBwi3uVX02IfEggHIQfk9Nj7OmrxICX0D%2BS1Cb5nAiAzjUkwv%2FyMxgxGcStmDSx1KTbNUIE60tgfWiaVyOrWByq6Agi%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAMaDDM3MjI1MzEwNDk5NiIMDA0RemEdsIWHrnXYKo4CySV5dvufxCewAaOSn57Thh9PEUZ7tMxWIdUNiu69FIhFJNlNtyialPULXveg31mxWhxD08HI1KETWuhMj0k0iPUlLFrLRXcdSldJn7iVXnLXtpE0QmzsnZx3CIl%2BwjvvpeJueu49TYdOnxDG9PysU3MBup%2BHRJJVoKJq%2FX%2FuYkE1T%2B9RvVnAg3TEVMLFWA1IfMWfjsW5VtH7MSFQe%2FpujT2Ti2GnQoESiEDB6FGJSU0xV83fqmH%2FaHw28DsV1HW%2FX8pRJgAGgkRNZxg2%2FwBcJCtjdXzYizqx8NvtT1uuIswpqTrRRBnHD4kjwFXvinFFvObdrjBtp5FGMJ34bNPTo7vLkYVqOX3XEhg0yQApML71%2BcsGOp4BIcNn9GxxSDJ1axNLhk7uwxnqePvIG5ajc9HP4Z9kRmNvkX8u2%2FrCqVfCQWC5NSlaF%2B3EQfUVBiBF0asFIbuFWorF3%2FX5OQusSrHRlHVNcpJqpAKUKJbY74xfcFCRqHg%2FPh0vV5QFWvp5fJatNjbQbZAqCVsNeNweoua%2FrJK%2B9QRybjekeB9tWhsdlfsstVY8OxLLIA4%2BxynhKn2OUqY%3D&X-Amz-Signature=78b136e0c8e94db5a1f346438ef594c548f2205bd4600d156a7997166b245b47&X-Amz-SignedHeaders=host&x-amz-checksum-sha256=47DEQpj8HBSa%2B%2FTImW%2B5JCeuQeRkm5NMpJWZG3hSuFU%3D&x-amz-sdk-checksum-algorithm=SHA256&x-id=PutObject"
  }
}
  Uploading archive to https://deployment-artifacts-372253104996-us-west-2.s3.us-west-2.amazonaws.com/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a_0e8d5f11-0ddb-421f-8bf4-e5560686639e?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAVNLADTNSKN2PASHK%2F20260131%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20260131T221330Z&X-Amz-Expires=300&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPb%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLXdlc3QtMiJGMEQCIBHgOBwi3uVX02IfEggHIQfk9Nj7OmrxICX0D%2BS1Cb5nAiAzjUkwv%2FyMxgxGcStmDSx1KTbNUIE60tgfWiaVyOrWByq6Agi%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAMaDDM3MjI1MzEwNDk5NiIMDA0RemEdsIWHrnXYKo4CySV5dvufxCewAaOSn57Thh9PEUZ7tMxWIdUNiu69FIhFJNlNtyialPULXveg31mxWhxD08HI1KETWuhMj0k0iPUlLFrLRXcdSldJn7iVXnLXtpE0QmzsnZx3CIl%2BwjvvpeJueu49TYdOnxDG9PysU3MBup%2BHRJJVoKJq%2FX%2FuYkE1T%2B9RvVnAg3TEVMLFWA1IfMWfjsW5VtH7MSFQe%2FpujT2Ti2GnQoESiEDB6FGJSU0xV83fqmH%2FaHw28DsV1HW%2FX8pRJgAGgkRNZxg2%2FwBcJCtjdXzYizqx8NvtT1uuIswpqTrRRBnHD4kjwFXvinFFvObdrjBtp5FGMJ34bNPTo7vLkYVqOX3XEhg0yQApML71%2BcsGOp4BIcNn9GxxSDJ1axNLhk7uwxnqePvIG5ajc9HP4Z9kRmNvkX8u2%2FrCqVfCQWC5NSlaF%2B3EQfUVBiBF0asFIbuFWorF3%2FX5OQusSrHRlHVNcpJqpAKUKJbY74xfcFCRqHg%2FPh0vV5QFWvp5fJatNjbQbZAqCVsNeNweoua%2FrJK%2B9QRybjekeB9tWhsdlfsstVY8OxLLIA4%2BxynhKn2OUqY%3D&X-Amz-Signature=78b136e0c8e94db5a1f346438ef594c548f2205bd4600d156a7997166b245b47&X-Amz-SignedHeaders=host&x-amz-checksum-sha256=47DEQpj8HBSa%2B%2FTImW%2B5JCeuQeRkm5NMpJWZG3hSuFU%3D&x-amz-sdk-checksum-algorithm=SHA256&x-id=PutObject...
  ◀️  GraphQL
Request ID: dcadf0d5-6639-4107-a176-187cc8dc6c37
Result: {
  "createHostedResourceUploadUrl": {
    "success": true,
    "errors": null,
    "preSignedUrls": [
      {
        "uploadUrl": "https://forge-cdn-tmp-prod.s3.us-west-2.amazonaws.com/",
        "uploadFormData": {
          "key": "c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a/51a33afd-8063-435e-9b4b-846eb64f676f/b96d5082-b1b2-484e-95f5-c35d310d0d31/settings.zip",
          "bucket": "forge-cdn-tmp-prod",
          "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
          "X-Amz-Credential": "ASIAVNLADTNSKN2PASHK/20260131/us-west-2/s3/aws4_request",
          "X-Amz-Date": "20260131T221330Z",
          "Policy": "eyJleHBpcmF0aW9uIjoiMjAyNi0wMS0zMVQyMjoxODozMFoiLCJjb25kaXRpb25zIjpbWyJlcSIsIiRDb250ZW50LVR5cGUiLCJhcHBsaWNhdGlvbi96aXAiXSxbInN0YXJ0cy13aXRoIiwiJGtleSIsImM4YmFiMWRjLWFlMzItNGU2Zi05ZGJkLWViMjQyY2M2YzE0YS81MWEzM2FmZC04MDYzLTQzNWUtOWI0Yi04NDZlYjY0ZjY3NmYvYjk2ZDUwODItYjFiMi00ODRlLTk1ZjUtYzM1ZDMxMGQwZDMxL3NldHRpbmdzIl0sWyJlcSIsIiRhY2wiLCJidWNrZXQtb3duZXItZnVsbC1jb250cm9sIl0seyJrZXkiOiJjOGJhYjFkYy1hZTMyLTRlNmYtOWRiZC1lYjI0MmNjNmMxNGEvNTFhMzNhZmQtODA2My00MzVlLTliNGItODQ2ZWI2NGY2NzZmL2I5NmQ1MDgyLWIxYjItNDg0ZS05NWY1LWMzNWQzMTBkMGQzMS9zZXR0aW5ncy56aXAifSx7ImJ1Y2tldCI6ImZvcmdlLWNkbi10bXAtcHJvZCJ9LHsiWC1BbXotQWxnb3JpdGhtIjoiQVdTNC1ITUFDLVNIQTI1NiJ9LHsiWC1BbXotQ3JlZGVudGlhbCI6IkFTSUFWTkxBRFROU0tOMlBBU0hLLzIwMjYwMTMxL3VzLXdlc3QtMi9zMy9hd3M0X3JlcXVlc3QifSx7IlgtQW16LURhdGUiOiIyMDI2MDEzMVQyMjEzMzBaIn0seyJYLUFtei1TZWN1cml0eS1Ub2tlbiI6IklRb0piM0pwWjJsdVgyVmpFUGIvLy8vLy8vLy8vd0VhQ1hWekxYZGxjM1F0TWlKR01FUUNJQkhnT0J3aTN1VlgwMklmRWdnSElRZms5Tmo3T21yeElDWDBEK1MxQ2I1bkFpQXpqVWt3di95TXhneEdjU3RtRFN4MUtUYk5VSUU2MHRnZldpYVZ5T3JXQnlxNkFnaS8vLy8vLy8vLy8vOEJFQU1hRERNM01qSTFNekV3TkRrNU5pSU1EQTBSZW1FZHNJV0hyblhZS280Q3lTVjVkdnVmeENld0FhT1NuNTdUaGg5UEVVWjd0TXhXSWRVTml1NjlGSWhGSk5sTnR5aWFsUFVMWHZlZzMxbXhXaHhEMDhISTFLRVRXdWhNajBrMGlQVWxMRnJMUlhjZFNsZEpuN2lWWG5MWHRwRTBRbXpzblp4M0NJbCt3anZ2cGVKdWV1NDlUWWRPbnhERzlQeXNVM01CdXArSFJKSlZvS0pxL1gvdVlrRTFUKzlSdlZuQWczVEVWTUxGV0ExSWZNV2Zqc1c1VnRIN01TRlFlL3B1alQyVGkyR25Rb0VTaUVEQjZGR0pTVTB4VjgzZnFtSC9hSHcyOERzVjFIVy9YOHBSSmdBR2drUk5aeGcyL3dCY0pDdGpkWHpZaXpxeDhOdnRUMXV1SXN3cHFUclJSQm5IRDRrandGWHZpbkZGdk9iZHJqQnRwNUZHTUozNGJOUFRvN3ZMa1lWcU9YM1hFaGcweVFBcE1MNzErY3NHT3A0QkljTm45R3h4U0RKMWF4Tkxoazd1d3hucWVQdklHNWFqYzlIUDRaOWtSbU52a1g4dTIvckNxVmZDUVdDNU5TbGFGKzNFUWZVVkJpQkYwYXNGSWJ1RldvckYzL1g1T1F1c1NySFJsSFZOY3BKcXBBS1VLSmJZNzR4ZmNGQ1JxSGcvUGgwdlY1UUZXdnA1ZkphdE5qYlFiWkFxQ1ZzTmVOd2VvdWEvckpLKzlRUnliamVrZUI5dFdoc2RsZnNzdFZZOE94TExJQTQreHluaEtuMk9VcVk9In1dfQ==",
          "X-Amz-Signature": "47f3185d93fe3c50b4518ed40a3c5519eb560c229356d99210e66cb1d74cb2fa"
        }
      },
      {
        "uploadUrl": "https://forge-cdn-tmp-prod.s3.us-west-2.amazonaws.com/",
        "uploadFormData": {
          "key": "c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a/51a33afd-8063-435e-9b4b-846eb64f676f/b96d5082-b1b2-484e-95f5-c35d310d0d31/main.zip",
          "bucket": "forge-cdn-tmp-prod",
          "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
          "X-Amz-Credential": "ASIAVNLADTNSKN2PASHK/20260131/us-west-2/s3/aws4_request",
          "X-Amz-Date": "20260131T221330Z",
          "Policy": "eyJleHBpcmF0aW9uIjoiMjAyNi0wMS0zMVQyMjoxODozMFoiLCJjb25kaXRpb25zIjpbWyJlcSIsIiRDb250ZW50LVR5cGUiLCJhcHBsaWNhdGlvbi96aXAiXSxbInN0YXJ0cy13aXRoIiwiJGtleSIsImM4YmFiMWRjLWFlMzItNGU2Zi05ZGJkLWViMjQyY2M2YzE0YS81MWEzM2FmZC04MDYzLTQzNWUtOWI0Yi04NDZlYjY0ZjY3NmYvYjk2ZDUwODItYjFiMi00ODRlLTk1ZjUtYzM1ZDMxMGQwZDMxL21haW4iXSxbImVxIiwiJGFjbCIsImJ1Y2tldC1vd25lci1mdWxsLWNvbnRyb2wiXSx7ImtleSI6ImM4YmFiMWRjLWFlMzItNGU2Zi05ZGJkLWViMjQyY2M2YzE0YS81MWEzM2FmZC04MDYzLTQzNWUtOWI0Yi04NDZlYjY0ZjY3NmYvYjk2ZDUwODItYjFiMi00ODRlLTk1ZjUtYzM1ZDMxMGQwZDMxL21haW4uemlwIn0seyJidWNrZXQiOiJmb3JnZS1jZG4tdG1wLXByb2QifSx7IlgtQW16LUFsZ29yaXRobSI6IkFXUzQtSE1BQy1TSEEyNTYifSx7IlgtQW16LUNyZWRlbnRpYWwiOiJBU0lBVk5MQURUTlNLTjJQQVNISy8yMDI2MDEzMS91cy13ZXN0LTIvczMvYXdzNF9yZXF1ZXN0In0seyJYLUFtei1EYXRlIjoiMjAyNjAxMzFUMjIxMzMwWiJ9LHsiWC1BbXotU2VjdXJpdHktVG9rZW4iOiJJUW9KYjNKcFoybHVYMlZqRVBiLy8vLy8vLy8vL3dFYUNYVnpMWGRsYzNRdE1pSkdNRVFDSUJIZ09Cd2kzdVZYMDJJZkVnZ0hJUWZrOU5qN09tcnhJQ1gwRCtTMUNiNW5BaUF6alVrd3YveU14Z3hHY1N0bURTeDFLVGJOVUlFNjB0Z2ZXaWFWeU9yV0J5cTZBZ2kvLy8vLy8vLy8vLzhCRUFNYURETTNNakkxTXpFd05EazVOaUlNREEwUmVtRWRzSVdIcm5YWUtvNEN5U1Y1ZHZ1ZnhDZXdBYU9TbjU3VGhoOVBFVVo3dE14V0lkVU5pdTY5RkloRkpObE50eWlhbFBVTFh2ZWczMW14V2h4RDA4SEkxS0VUV3VoTWowazBpUFVsTEZyTFJYY2RTbGRKbjdpVlhuTFh0cEUwUW16c25aeDNDSWwrd2p2dnBlSnVldTQ5VFlkT254REc5UHlzVTNNQnVwK0hSSkpWb0tKcS9YL3VZa0UxVCs5UnZWbkFnM1RFVk1MRldBMUlmTVdmanNXNVZ0SDdNU0ZRZS9wdWpUMlRpMkduUW9FU2lFREI2RkdKU1UweFY4M2ZxbUgvYUh3MjhEc1YxSFcvWDhwUkpnQUdna1JOWnhnMi93QmNKQ3RqZFh6WWl6cXg4TnZ0VDF1dUlzd3BxVHJSUkJuSEQ0a2p3Rlh2aW5GRnZPYmRyakJ0cDVGR01KMzRiTlBUbzd2TGtZVnFPWDNYRWhnMHlRQXBNTDcxK2NzR09wNEJJY05uOUd4eFNESjFheE5MaGs3dXd4bnFlUHZJRzVhamM5SFA0WjlrUm1OdmtYOHUyL3JDcVZmQ1FXQzVOU2xhRiszRVFmVVZCaUJGMGFzRklidUZXb3JGMy9YNU9RdXNTckhSbEhWTmNwSnFwQUtVS0piWTc0eGZjRkNScUhnL1BoMHZWNVFGV3ZwNWZKYXROamJRYlpBcUNWc05lTndlb3VhL3JKSys5UVJ5Ympla2VCOXRXaHNkbGZzc3RWWThPeExMSUE0K3h5bmhLbjJPVXFZPSJ9XX0=",
          "X-Amz-Signature": "ea510e7d0fcfee9739e426b12314bfa9ff5f8dfb09cd389441abd1814565c644"
        }
      }
    ],
    "uploadId": "b96d5082-b1b2-484e-95f5-c35d310d0d31"
  }
}
  Uploading resources
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
      mutation forge_cli_deployApplication($input: CreateAppDeploymentInput!) {
        createAppDeployment(input: $input) {
          success
          errors {
            message
            extensions {
              errorType
              statusCode
            }
          }
          deployment {
            id
          }
        }
      }

Variables: {
  "input": {
    "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
    "environmentKey": "default",
    "artifactUrl": "https://deployment-artifacts-372253104996-us-west-2.s3.us-west-2.amazonaws.com/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a_0e8d5f11-0ddb-421f-8bf4-e5560686639e?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAVNLADTNSKN2PASHK%2F20260131%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20260131T221330Z&X-Amz-Expires=300&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPb%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLXdlc3QtMiJGMEQCIBHgOBwi3uVX02IfEggHIQfk9Nj7OmrxICX0D%2BS1Cb5nAiAzjUkwv%2FyMxgxGcStmDSx1KTbNUIE60tgfWiaVyOrWByq6Agi%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAMaDDM3MjI1MzEwNDk5NiIMDA0RemEdsIWHrnXYKo4CySV5dvufxCewAaOSn57Thh9PEUZ7tMxWIdUNiu69FIhFJNlNtyialPULXveg31mxWhxD08HI1KETWuhMj0k0iPUlLFrLRXcdSldJn7iVXnLXtpE0QmzsnZx3CIl%2BwjvvpeJueu49TYdOnxDG9PysU3MBup%2BHRJJVoKJq%2FX%2FuYkE1T%2B9RvVnAg3TEVMLFWA1IfMWfjsW5VtH7MSFQe%2FpujT2Ti2GnQoESiEDB6FGJSU0xV83fqmH%2FaHw28DsV1HW%2FX8pRJgAGgkRNZxg2%2FwBcJCtjdXzYizqx8NvtT1uuIswpqTrRRBnHD4kjwFXvinFFvObdrjBtp5FGMJ34bNPTo7vLkYVqOX3XEhg0yQApML71%2BcsGOp4BIcNn9GxxSDJ1axNLhk7uwxnqePvIG5ajc9HP4Z9kRmNvkX8u2%2FrCqVfCQWC5NSlaF%2B3EQfUVBiBF0asFIbuFWorF3%2FX5OQusSrHRlHVNcpJqpAKUKJbY74xfcFCRqHg%2FPh0vV5QFWvp5fJatNjbQbZAqCVsNeNweoua%2FrJK%2B9QRybjekeB9tWhsdlfsstVY8OxLLIA4%2BxynhKn2OUqY%3D&X-Amz-Signature=78b136e0c8e94db5a1f346438ef594c548f2205bd4600d156a7997166b245b47&X-Amz-SignedHeaders=host&x-amz-checksum-sha256=47DEQpj8HBSa%2B%2FTImW%2B5JCeuQeRkm5NMpJWZG3hSuFU%3D&x-amz-sdk-checksum-algorithm=SHA256&x-id=PutObject",
    "hostedResourceUploadId": "b96d5082-b1b2-484e-95f5-c35d310d0d31"
  }
}
  ◀️  GraphQL
Request ID: 4e600939-90ac-448c-b443-7ea1f49a21d9
Result: {
  "createAppDeployment": {
    "success": true,
    "errors": null,
    "deployment": {
      "id": "236"
    }
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 11f64341-58ae-4dcf-a91d-6699f8187f0d
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
i Validating manifest
  Artifact validation started
  Upload URL is valid
  Artifact validation completed
  Found manifest file
  Manifest is a valid YAML
  Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.
  Manifest passed common validations
  Manifest doesn't have forbidden modules
i Snapshotting functions
i Deploying to environment
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 55d37b6c-a9e6-4ae8-beef-6848684097b4
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: c2fd5e2f-db0d-4fcb-8383-5d158a9282d5
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          }
        ]
      }
    ]
  }
}
  [ca-central-1] Artifact copied
  [us-east-1] Artifact copied
  [ap-northeast-1] Artifact copied
  [eu-west-2] Artifact copied
  [eu-west-1] Artifact copied
  [eu-central-2] Artifact copied
  [ap-northeast-2] Artifact copied
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 52363c3c-bb14-4e6f-a046-b7a4818ba315
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  [eu-central-1] Artifact copied
  [ap-south-1] Artifact copied
  [ap-southeast-1] Artifact copied
  [ap-southeast-2] Artifact copied
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 4787be71-817c-4bce-8c04-e2eae915bf6f
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: d1282054-1f3f-440b-85ca-d2b05d621f9a
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 59ecf3ad-fad6-4f7a-82f9-5d0c5da82795
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 5e8400ec-20a7-45f8-9f46-55ca1113d1f8
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: a7f881cc-9716-43e0-aa17-a8311b6b3cb2
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: bbd9dd55-86f2-4efe-b2da-9be9cccf031e
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: ad361422-0cc1-4f4e-be84-f808da7d9f88
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: d3df6cbc-57be-49b0-993d-4c7cf58769f1
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 9a3d1703-b016-4c37-9c61-2041a81c4ec9
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: ad07d0b1-57dd-4c45-9109-5f73b43c7bc9
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: dbc3ac23-1881-4e39-8374-f430bac0ac6e
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 93e2fa71-0748-4c13-9c66-6215c37ba901
Result: {
  "appDeployment": {
    "status": "IN_PROGRESS",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:52.288Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Save environment variables snapshot",
            "createdAt": "2026-01-31T22:13:52.289Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release services",
            "createdAt": "2026-01-31T22:13:52.289Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release services",
            "createdAt": "2026-01-31T22:13:52.289Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Save environment variables snapshot",
            "createdAt": "2026-01-31T22:13:52.601Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Upsert custom entities",
            "createdAt": "2026-01-31T22:13:52.601Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Upsert custom entities",
            "createdAt": "2026-01-31T22:13:52.601Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release CaaS manifest",
            "createdAt": "2026-01-31T22:13:52.602Z",
            "newStatus": "STARTED"
          }
        ]
      }
    ]
  }
}
  ▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getApplicationDeploymentStatus($appId: ID!, $environmentKey: String!, $id: ID!) {
          appDeployment(appId: $appId, environmentKey: $environmentKey, id: $id) {
            status
            errorDetails {
              code
              message
              fields
            }
            stages {
              description
              events {
                __typename
                stepName
                createdAt
                ...on AppDeploymentLogEvent {
                  message
                  level
                }
                ... on AppDeploymentTransitionEvent {
                  newStatus
                }
              }
            }
          }
        }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "id": "236"
}
  ◀️  GraphQL
Request ID: 39c35aa5-12e2-4bf0-aa70-83bb74882c43
Result: {
  "appDeployment": {
    "status": "DONE",
    "errorDetails": null,
    "stages": [
      {
        "description": "Validating manifest",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.339Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Init deployment",
            "createdAt": "2026-01-31T22:13:34.566Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Artifact validation started",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "message": "Upload URL is valid",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.567Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate Artifact",
            "createdAt": "2026-01-31T22:13:34.635Z",
            "message": "Artifact validation completed",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Prepare Artifact",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.636Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.768Z",
            "message": "Found manifest file",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.769Z",
            "message": "Manifest is a valid YAML",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Download manifest",
            "createdAt": "2026-01-31T22:13:34.799Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.800Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.807Z",
            "message": "Manifest passed trigger schema validation. Modules with string array: 0, modules with TriggerEventArray: 0.",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest passed common validations",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.900Z",
            "message": "Manifest doesn't have forbidden modules",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Manage custom scopes",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate manifest",
            "createdAt": "2026-01-31T22:13:34.901Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Enrich manifest",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Snapshotting functions",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Generate snapshot step",
            "createdAt": "2026-01-31T22:13:34.903Z",
            "newStatus": "DONE"
          }
        ]
      },
      {
        "description": "Deploying to environment",
        "events": [
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:34.904Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Validate hosted resource upload step",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Sign artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:35.402Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.489Z",
            "message": "[ca-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.557Z",
            "message": "[us-east-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:36.918Z",
            "message": "[ap-northeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.139Z",
            "message": "[eu-west-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.179Z",
            "message": "[eu-west-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.288Z",
            "message": "[eu-central-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.383Z",
            "message": "[ap-northeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:37.774Z",
            "message": "[eu-central-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.307Z",
            "message": "[ap-south-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.407Z",
            "message": "[ap-southeast-1] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentLogEvent",
            "stepName": "Distribute artifact",
            "createdAt": "2026-01-31T22:13:38.555Z",
            "message": "[ap-southeast-2] Artifact copied",
            "level": "INFO"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:38.556Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release Lambda functions",
            "createdAt": "2026-01-31T22:13:52.288Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Save environment variables snapshot",
            "createdAt": "2026-01-31T22:13:52.289Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release services",
            "createdAt": "2026-01-31T22:13:52.289Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release services",
            "createdAt": "2026-01-31T22:13:52.289Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Save environment variables snapshot",
            "createdAt": "2026-01-31T22:13:52.601Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Upsert custom entities",
            "createdAt": "2026-01-31T22:13:52.601Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Upsert custom entities",
            "createdAt": "2026-01-31T22:13:52.601Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release CaaS manifest",
            "createdAt": "2026-01-31T22:13:52.602Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Create outbound-auth services",
            "createdAt": "2026-01-31T22:13:53.782Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Release CaaS manifest",
            "createdAt": "2026-01-31T22:13:53.782Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Upsert scheduled triggers",
            "createdAt": "2026-01-31T22:13:53.858Z",
            "newStatus": "STARTED"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Create outbound-auth services",
            "createdAt": "2026-01-31T22:13:53.858Z",
            "newStatus": "DONE"
          },
          {
            "__typename": "AppDeploymentTransitionEvent",
            "stepName": "Upsert scheduled triggers",
            "createdAt": "2026-01-31T22:13:53.859Z",
            "newStatus": "DONE"
          }
        ]
      }
    ]
  }
}

√ Deployed

Deployed Time Tracker to the development environment.
▶️  GraphQL https://api.atlassian.com/graphql
Query:
      query forge_cli_getEcosystemInstallationsByApp($filter: AppInstallationsByAppFilter!, $first: Int, $after: String) {
        ecosystem {
          appInstallationsByApp(filter: $filter, first: $first, after: $after) {
            nodes {
              id
              installationContext
              secondaryInstallationContexts
              appEnvironment {
                key
                type
              }
              appEnvironmentVersion {
                isLatest
                version
                permissions {
                  scopes {
                    key
                  }
                  egress {
                    addresses
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }

Variables: {
  "filter": {
    "apps": {
      "ids": [
        "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a"
      ]
    },
    "appEnvironments": {
      "types": [
        "DEVELOPMENT"
      ]
    }
  },
  "first": 100
}
◀️  GraphQL
Request ID: b58245b4-6a41-4760-9105-8e89f1f918cd
Result: {
  "ecosystem": {
    "appInstallationsByApp": {
      "nodes": [
        {
          "id": "ffde2508-71ac-40e2-815a-e49ebd32e23e",
          "installationContext": "ari:cloud:jira::site/39b6eab6-88fd-45b6-8bbc-dad801bac3bd",
          "secondaryInstallationContexts": [],
          "appEnvironment": {
            "key": "default",
            "type": "DEVELOPMENT"
          },
          "appEnvironmentVersion": {
            "isLatest": true,
            "version": "4.111.0",
            "permissions": [
              {
                "scopes": [
                  {
                    "key": "read:me"
                  },
                  {
                    "key": "read:jira-work"
                  },
                  {
                    "key": "write:jira-work"
                  },
                  {
                    "key": "read:jira-user"
                  },
                  {
                    "key": "storage:app"
                  }
                ],
                "egress": [
                  {
                    "addresses": [
                      "*.supabase.co"
                    ]
                  },
                  {
                    "addresses": [
                      "*.supabase.co",
                      "https://forgesync.amzur.com"
                    ]
                  }
                ]
              }
            ]
          }
        }
      ],
      "pageInfo": {
        "hasNextPage": false,
        "endCursor": "MA=="
      }
    }
  }
}
▶️  GraphQL https://api.atlassian.com/graphql
Query:
        query forge_cli_getHostnameForTenantContexts($cloudIds: [ID!]!) {
            tenantContexts(cloudIds: $cloudIds) {
                hostName
            }
        }

Variables: {
  "cloudIds": [
    "39b6eab6-88fd-45b6-8bbc-dad801bac3bd"
  ]
}
◀️  GraphQL
Request ID: 9e7d6b99-dffe-483f-88bf-1c5b13363516
Result: {
  "tenantContexts": [
    {
      "hostName": "amzur-itracker.atlassian.net"
    }
  ]
}
▶️  GraphQL https://api.atlassian.com/graphql
Query:
      query forge_cli_getApplicationRoaEligibility($appId: ID!, $environmentKey: String!, $firstN: Int!, $majorVersion: Int) {
        app(id: $appId) {
          environmentByKey(key: $environmentKey) {
            type
            versions(first: $firstN, majorVersion: $majorVersion) {
              nodes {
                version
                isLatest
                trustSignal(key: "RUNS_ON_ATLASSIAN") @optIn(to: ["AppEnvironmentVersionTrustSignal"]) {
                  key
                  result
                  rules {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }

Variables: {
  "appId": "ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a",
  "environmentKey": "default",
  "firstN": 1
}
◀️  GraphQL
Request ID: 1491cde2-cd82-4532-9b55-6102c24a3eee
Result: {
  "app": {
    "environmentByKey": {
      "type": "DEVELOPMENT",
      "versions": {
        "nodes": [
          {
            "version": "4.111.0",
            "isLatest": true,
            "trustSignal": {
              "key": "RUNS_ON_ATLASSIAN",
              "result": false,
              "rules": [
                {
                  "name": "HAS_REMOTES",
                  "value": true
                },
                {
                  "name": "HAS_CONNECT_MODULES",
                  "value": false
                },
                {
                  "name": "HAS_DEFINED_EGRESS",
                  "value": true
                },
                {
                  "name": "HAS_EXPOSED_CREDENTIALS",
                  "value": false
                },
                {
                  "name": "HAS_NON_DARE_COMPLIANT_SQL_MODULE",
                  "value": false
                },
                {
                  "name": "HAS_EGRESS_WEBTRIGGER_MODULE",
                  "value": false
                },
                {
                  "name": "HAS_PERSONAL_API_TOKEN_USAGE",
                  "value": false
                }
              ]
            }
          }
        ]
      }
    }
  }
}

i The version of your app [4.111.0] that was just deployed to [development] is not eligible for the Runs on Atlassian program. Run forge eligibility to know more.

To know more about Runs on Atlassian, go to https://go.atlassian.com/runs-on-atlassian.
PS C:\ATG\jira4\JIRAForge\forge-app>