export class Fault extends Error { constructor(public status:number,message:string){super(message)} }
