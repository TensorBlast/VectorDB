import * as dotenv from 'dotenv';

export default async function setenv(dotenvpath: string) {
    console.log('DOTENV PATH = ' + dotenvpath);
    if (dotenvpath !== undefined && dotenvpath !== null && dotenvpath.length>0) {
        dotenv.config({ path: dotenvpath });
    }
}
