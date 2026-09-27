  import { checkPermission } from './backend/permissions.js'

async function test() {
  const result = await checkPermission(
    '84a03b55-fd47-40e5-a649-3ad3e422f2d2',
    'doc_1',        // <-- underscore, matching the actual row
    undefined,
    'insert'
  )
  console.log(result)
}

test()