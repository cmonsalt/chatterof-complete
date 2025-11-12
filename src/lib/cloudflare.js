/**
 * Delete a file from Cloudflare R2
 * @param {string} fileKey - The R2 file key (path)
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteFromR2(fileKey) {
  if (!fileKey) {
    console.warn('⚠️ No fileKey provided to deleteFromR2')
    return false
  }

  try {
    console.log(`🗑️ Deleting from R2: ${fileKey}`)

    const response = await fetch('/api/cloudflare/delete-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileKey })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.details || 'Failed to delete from R2')
    }

    const data = await response.json()
    console.log(`✅ R2 delete successful:`, data.message)
    
    return true

  } catch (error) {
    console.error('❌ Error deleting from R2:', error)
    return false
  }
}

/**
 * Delete multiple files from R2
 * @param {string[]} fileKeys - Array of R2 file keys
 * @returns {Promise<number>} - Number of successfully deleted files
 */
export async function deleteManyFromR2(fileKeys) {
  if (!fileKeys || fileKeys.length === 0) {
    return 0
  }

  console.log(`🗑️ Deleting ${fileKeys.length} files from R2...`)

  const results = await Promise.allSettled(
    fileKeys.map(key => deleteFromR2(key))
  )

  const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length

  console.log(`✅ Deleted ${successCount}/${fileKeys.length} files from R2`)

  return successCount
}
