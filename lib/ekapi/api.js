import settings from "../settings.js";
import _ from 'lodash'

const baseurl = _.get(
          settings.getConfig('panel'),
          'EnkaUrl',
          'enka.network' // 默认值
        )
export  const ENKA_API = `https://${baseurl}/api/zzz/uid/{uid}`

