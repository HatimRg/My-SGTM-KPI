export const PROJECT_LIST_PREFERENCE = {
  CODE: 'code',
  NAME: 'name',
}

export function getProjectLabel(project) {
  const code = project?.code ? String(project.code).trim() : ''
  const name = project?.name ? String(project.name).trim() : ''
  if (!code && !name) return ''
  if (!code) return name
  if (!name) return code
  return `${code} - ${name}`
}

export function sortProjects(projects, preference = PROJECT_LIST_PREFERENCE.CODE) {
  const list = Array.isArray(projects) ? [...projects] : []
  const pref = preference === PROJECT_LIST_PREFERENCE.NAME ? PROJECT_LIST_PREFERENCE.NAME : PROJECT_LIST_PREFERENCE.CODE

  const normalize = (v) => String(v ?? '').trim().toLowerCase()

  list.sort((a, b) => {
    const aCode = normalize(a?.code)
    const bCode = normalize(b?.code)
    const aName = normalize(a?.name)
    const bName = normalize(b?.name)

    if (pref === PROJECT_LIST_PREFERENCE.NAME) {
      const byName = aName.localeCompare(bName)
      if (byName !== 0) return byName
      return aCode.localeCompare(bCode)
    }

    const byCode = aCode.localeCompare(bCode)
    if (byCode !== 0) return byCode
    return aName.localeCompare(bName)
  })

  return list
}
